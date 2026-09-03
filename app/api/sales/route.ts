import { NextResponse } from "next/server";
import { lockProductRows, prisma, isForeignKeyConstraint, isSerializationConflict, isUniqueConstraint, runSerializableTransaction } from "@/lib/db";
import { saleInputSchema } from "@/lib/validation";
import { authorize } from "@/lib/authz";
import { errorResponse, readJson } from "@/lib/http";
import { saleFingerprint } from "@/lib/idempotency";

async function findSale(saleNo: string) {
  return prisma.sale.findUnique({
    where: { saleNo },
    include: { lines: { select: { productId: true, quantity: true, unitPriceRial: true } } },
  });
}

function saleReplayResponse(
  existing: Awaited<ReturnType<typeof findSale>>,
  incoming: { customerId?: string | null; lines: Array<{ productId: string; quantity: number; unitPriceRial: bigint }> },
) {
  if (!existing) return errorResponse(409, "IDEMPOTENCY_CONFLICT", "فاکتور تکراری پیدا نشد؛ درخواست را دوباره ارسال کنید.");

  const existingFingerprint = saleFingerprint({
    customerId: existing.customerId,
    lines: existing.lines.map((line) => ({
      productId: line.productId,
      quantity: line.quantity,
      price: line.unitPriceRial,
    })),
  });
  const incomingFingerprint = saleFingerprint({
    customerId: incoming.customerId,
    lines: incoming.lines.map((line) => ({
      productId: line.productId,
      quantity: line.quantity,
      price: line.unitPriceRial,
    })),
  });

  if (existingFingerprint !== incomingFingerprint) {
    return errorResponse(409, "IDEMPOTENCY_CONFLICT", "این شماره فروش قبلاً با اطلاعات دیگری ثبت شده است.");
  }

  return NextResponse.json({ id: existing.id, saleNo: existing.saleNo }, { status: 200 });
}

export async function POST(request: Request) {
  const authorization = await authorize(["MANAGER", "SALES"]);
  if (!authorization.ok) {
    return errorResponse(
      authorization.status,
      authorization.status === 401 ? "UNAUTHENTICATED" : "FORBIDDEN",
      authorization.status === 401 ? "ورود به سیستم الزامی است." : "دسترسی لازم برای ثبت فروش را ندارید.",
    );
  }

  const body = await readJson(request);
  if (!body.ok) return errorResponse(400, "INVALID_JSON", "بدنه درخواست معتبر نیست.");

  const parsed = saleInputSchema.safeParse(body.data);
  if (!parsed.success) {
    return errorResponse(400, "VALIDATION_ERROR", "اطلاعات فروش معتبر نیست.", parsed.error.flatten());
  }

  const { saleNo, customerId, lines } = parsed.data;
  const existing = await findSale(saleNo);
  if (existing) return saleReplayResponse(existing, parsed.data);

  try {
    const sale = await runSerializableTransaction(async (transaction) => {
      await lockProductRows(transaction, lines.map((line) => line.productId));

      const products = await transaction.product.findMany({
        where: { id: { in: lines.map((line) => line.productId) }, isActive: true },
        select: { id: true },
      });
      const productIds = new Set(products.map((product) => product.id));

      if (productIds.size !== lines.length) throw new Error("PRODUCT_NOT_FOUND");

      const movements = await transaction.stockMovement.groupBy({
        by: ["productId", "type"],
        where: { productId: { in: lines.map((line) => line.productId) } },
        _sum: { quantity: true },
      });
      const stockByProduct = new Map<string, number>();
      for (const movement of movements) {
        const signed = ["RECEIPT", "ADJUSTMENT_IN", "RETURN_IN"].includes(movement.type)
          ? movement._sum.quantity ?? 0
          : -(movement._sum.quantity ?? 0);
        stockByProduct.set(movement.productId, (stockByProduct.get(movement.productId) ?? 0) + signed);
      }

      for (const line of lines) {
        if ((stockByProduct.get(line.productId) ?? 0) < line.quantity) {
          throw new Error("INSUFFICIENT_STOCK");
        }
      }

      const totalRial = lines.reduce(
        (total, line) => total + BigInt(line.quantity) * line.unitPriceRial,
        BigInt(0),
      );
      const createdSale = await transaction.sale.create({
        data: {
          saleNo,
          customerId: customerId ?? null,
          soldBy: authorization.user.id,
          totalRial,
          lines: { create: lines },
        },
      });

      await transaction.stockMovement.createMany({
        data: lines.map((line) => ({
          productId: line.productId,
          type: "SALE" as const,
          quantity: line.quantity,
          reason: "Sale completed",
          referenceId: createdSale.id,
          referenceType: "SALE",
          actorId: authorization.user.id,
        })),
      });

      return createdSale;
    });

    return NextResponse.json({ id: sale.id, saleNo: sale.saleNo }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "PRODUCT_NOT_FOUND") {
      return errorResponse(400, "PRODUCT_NOT_FOUND", "یکی از کالاها یافت نشد یا فعال نیست.");
    }
    if (error instanceof Error && error.message === "INSUFFICIENT_STOCK") {
      return errorResponse(409, "INSUFFICIENT_STOCK", "موجودی برای این فروش کافی نیست.");
    }
    if (isUniqueConstraint(error)) {
      return saleReplayResponse(await findSale(saleNo), parsed.data);
    }
    if (isForeignKeyConstraint(error)) {
      return errorResponse(400, "INVALID_REFERENCE", "مشتری معتبر نیست.");
    }
    if (isSerializationConflict(error)) {
      return errorResponse(503, "SERIALIZATION_RETRY_EXHAUSTED", "عملیات همزمان بود؛ لطفاً دوباره تلاش کنید.");
    }
    console.error("[api/sales] unexpected error:", error);
    return errorResponse(500, "SALE_CREATE_FAILED", "ثبت فروش انجام نشد.");
  }
}
