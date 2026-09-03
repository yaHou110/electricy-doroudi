import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { saleInputSchema } from "@/lib/validation";
import { requireRole } from "@/lib/authz";

export async function POST(request: Request) {
  const user = await requireRole(["MANAGER", "SALES"]);
  if (!user) return NextResponse.json({ error: "دسترسی لازم برای ثبت فروش را ندارید." }, { status: 403 });

  const parsed = saleInputSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "اطلاعات فروش معتبر نیست.", details: parsed.error.flatten() }, { status: 400 });
  }

  const { saleNo, customerId, lines } = parsed.data;
  const actorId = user.id;

  try {
    const sale = await prisma.$transaction(async (transaction) => {
      const products = await transaction.product.findMany({
        where: { id: { in: lines.map((line) => line.productId) }, isActive: true },
        select: { id: true },
      });
      const productIds = new Set(products.map((product) => product.id));

      if (productIds.size !== new Set(lines.map((line) => line.productId)).size) {
        throw new Error("PRODUCT_NOT_FOUND");
      }

      const movements = await transaction.stockMovement.groupBy({
        by: ["productId", "type"],
        where: { productId: { in: lines.map((line) => line.productId) } },
        _sum: { quantity: true },
      });
      const stockByProduct = new Map<string, number>();
      for (const movement of movements) {
        const signed = ["RECEIPT", "ADJUSTMENT_IN", "RETURN_IN"].includes(movement.type)
          ? Number(movement._sum.quantity ?? 0)
          : -Number(movement._sum.quantity ?? 0);
        stockByProduct.set(movement.productId, (stockByProduct.get(movement.productId) ?? 0) + signed);
      }

      for (const line of lines) {
        if ((stockByProduct.get(line.productId) ?? 0) < line.quantity) {
          throw new Error("INSUFFICIENT_STOCK");
        }
      }

      const totalRial = lines.reduce((total, line) => total + line.quantity * line.unitPriceRial, 0);
      const createdSale = await transaction.sale.create({
        data: {
          saleNo,
          customerId: customerId ?? null,
          soldBy: actorId,
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
          actorId,
        })),
      });

      return createdSale;
    }, { isolationLevel: "Serializable" });

    return NextResponse.json({ id: sale.id, saleNo: sale.saleNo }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "PRODUCT_NOT_FOUND") {
      return NextResponse.json({ error: "یکی از کالاها یافت نشد." }, { status: 400 });
    }
    if (error instanceof Error && error.message === "INSUFFICIENT_STOCK") {
      return NextResponse.json({ error: "موجودی برای این فروش کافی نیست." }, { status: 409 });
    }

    return NextResponse.json({ error: "ثبت فروش انجام نشد." }, { status: 409 });
  }
}
