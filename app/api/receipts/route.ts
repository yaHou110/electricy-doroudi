import { NextResponse } from "next/server";
import { lockProductRows, prisma, isForeignKeyConstraint, isSerializationConflict, isUniqueConstraint, runSerializableTransaction } from "@/lib/db";
import { receiptInputSchema } from "@/lib/validation";
import { authorize } from "@/lib/authz";
import { errorResponse, readJson } from "@/lib/http";
import { receiptFingerprint } from "@/lib/idempotency";

async function findReceipt(receiptNo: string) {
  return prisma.goodsReceipt.findUnique({
    where: { receiptNo },
    include: { lines: { select: { productId: true, quantity: true, unitCostRial: true } } },
  });
}

function receiptReplayResponse(
  existing: Awaited<ReturnType<typeof findReceipt>>,
  incoming: { supplierId?: string | null; notes?: string; lines: Array<{ productId: string; quantity: number; unitCostRial: bigint }> },
) {
  if (!existing) return errorResponse(409, "IDEMPOTENCY_CONFLICT", "رسید تکراری پیدا نشد؛ درخواست را دوباره ارسال کنید.");

  const existingFingerprint = receiptFingerprint({
    supplierId: existing.supplierId,
    notes: existing.notes,
    lines: existing.lines.map((line) => ({
      productId: line.productId,
      quantity: line.quantity,
      price: line.unitCostRial,
    })),
  });
  const incomingFingerprint = receiptFingerprint({
    supplierId: incoming.supplierId,
    notes: incoming.notes,
    lines: incoming.lines.map((line) => ({
      productId: line.productId,
      quantity: line.quantity,
      price: line.unitCostRial,
    })),
  });

  if (existingFingerprint !== incomingFingerprint) {
    return errorResponse(409, "IDEMPOTENCY_CONFLICT", "این شماره رسید قبلاً با اطلاعات دیگری ثبت شده است.");
  }

  return NextResponse.json({ id: existing.id, receiptNo: existing.receiptNo }, { status: 200 });
}

export async function POST(request: Request) {
  const authorization = await authorize(["MANAGER", "WAREHOUSE"]);
  if (!authorization.ok) {
    return errorResponse(
      authorization.status,
      authorization.status === 401 ? "UNAUTHENTICATED" : "FORBIDDEN",
      authorization.status === 401 ? "ورود به سیستم الزامی است." : "دسترسی لازم برای ثبت ورود کالا را ندارید.",
    );
  }

  const body = await readJson(request);
  if (!body.ok) return errorResponse(400, "INVALID_JSON", "بدنه درخواست معتبر نیست.");

  const parsed = receiptInputSchema.safeParse(body.data);
  if (!parsed.success) {
    return errorResponse(400, "VALIDATION_ERROR", "اطلاعات رسید معتبر نیست.", parsed.error.flatten());
  }

  const { receiptNo, supplierId, notes, lines } = parsed.data;
  const existing = await findReceipt(receiptNo);
  if (existing) return receiptReplayResponse(existing, parsed.data);

  try {
    const receipt = await runSerializableTransaction(async (transaction) => {
      await lockProductRows(transaction, lines.map((line) => line.productId));

      const products = await transaction.product.findMany({
        where: { id: { in: lines.map((line) => line.productId) }, isActive: true },
        select: { id: true },
      });
      const productIds = new Set(products.map((product) => product.id));

      if (productIds.size !== lines.length) throw new Error("PRODUCT_NOT_FOUND");

      const createdReceipt = await transaction.goodsReceipt.create({
        data: {
          receiptNo,
          supplierId: supplierId ?? null,
          receivedBy: authorization.user.id,
          notes,
          lines: { create: lines },
        },
      });

      await transaction.stockMovement.createMany({
        data: lines.map((line) => ({
          productId: line.productId,
          type: "RECEIPT" as const,
          quantity: line.quantity,
          reason: "Goods received",
          referenceId: createdReceipt.id,
          referenceType: "GOODS_RECEIPT",
          actorId: authorization.user.id,
        })),
      });

      return createdReceipt;
    });

    return NextResponse.json({ id: receipt.id, receiptNo: receipt.receiptNo }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "PRODUCT_NOT_FOUND") {
      return errorResponse(400, "PRODUCT_NOT_FOUND", "یکی از کالاها یافت نشد یا فعال نیست.");
    }
    if (isUniqueConstraint(error)) {
      return receiptReplayResponse(await findReceipt(receiptNo), parsed.data);
    }
    if (isForeignKeyConstraint(error)) {
      return errorResponse(400, "INVALID_REFERENCE", "تأمین‌کننده معتبر نیست.");
    }
    if (isSerializationConflict(error)) {
      return errorResponse(503, "SERIALIZATION_RETRY_EXHAUSTED", "عملیات همزمان بود؛ لطفاً دوباره تلاش کنید.");
    }
    console.error("[api/receipts] unexpected error:", error);
    return errorResponse(500, "RECEIPT_CREATE_FAILED", "ثبت رسید انجام نشد.");
  }
}
