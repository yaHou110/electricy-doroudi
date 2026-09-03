import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { receiptInputSchema } from "@/lib/validation";
import { requireRole } from "@/lib/authz";

export async function POST(request: Request) {
  const user = await requireRole(["MANAGER", "WAREHOUSE"]);
  if (!user) return NextResponse.json({ error: "دسترسی لازم برای ثبت ورود کالا را ندارید." }, { status: 403 });

  const parsed = receiptInputSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "اطلاعات رسید معتبر نیست.", details: parsed.error.flatten() }, { status: 400 });
  }

  const { receiptNo, supplierId, notes, lines } = parsed.data;
  const actorId = user.id;

  try {
    const receipt = await prisma.$transaction(async (transaction) => {
      const products = await transaction.product.findMany({
        where: { id: { in: lines.map((line) => line.productId) }, isActive: true },
        select: { id: true },
      });
      const productIds = new Set(products.map((product) => product.id));

      if (productIds.size !== new Set(lines.map((line) => line.productId)).size) {
        throw new Error("PRODUCT_NOT_FOUND");
      }

      const createdReceipt = await transaction.goodsReceipt.create({
        data: {
          receiptNo,
          supplierId: supplierId ?? null,
          receivedBy: actorId,
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
          actorId,
        })),
      });

      return createdReceipt;
    }, { isolationLevel: "Serializable" });

    return NextResponse.json({ id: receipt.id, receiptNo: receipt.receiptNo }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "PRODUCT_NOT_FOUND") {
      return NextResponse.json({ error: "یکی از کالاها یافت نشد." }, { status: 400 });
    }

    return NextResponse.json({ error: "ثبت رسید انجام نشد." }, { status: 409 });
  }
}
