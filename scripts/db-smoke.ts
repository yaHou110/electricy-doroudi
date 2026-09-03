import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const product = await prisma.product.findUnique({ where: { sku: "SCH-LC1D25" } });
  if (!product) throw new Error("seeded product missing");

  const warehouse = await prisma.warehouse.findFirst({ where: { isDefault: true } });
  if (!warehouse) throw new Error("default warehouse missing");

  const actor = await prisma.user.findUnique({ where: { email: "manager@droodi.local" } });
  if (!actor) throw new Error("seeded user missing");

  const previousReceipt = await prisma.goodsReceipt.findUnique({ where: { receiptNo: "SMOKE-1" } });
  await prisma.stockMovement.deleteMany({
    where: {
      referenceType: "GOODS_RECEIPT",
      referenceId: { in: ["SMOKE-1", previousReceipt?.id ?? ""] },
    },
  });
  await prisma.goodsReceipt.deleteMany({ where: { receiptNo: "SMOKE-1" } });

  // Transactional write path mirroring the receiving route shape.
  const receipt = await prisma.$transaction(
    async (tx) => {
      const createdReceipt = await tx.goodsReceipt.create({
        data: {
          receiptNo: "SMOKE-1",
          supplierId: null,
          receivedBy: actor.id,
          lines: {
            create: [{ productId: product.id, quantity: 10, unitCostRial: product.costPriceRial }],
          },
        },
      });
      await tx.stockMovement.create({
        data: {
          productId: product.id,
          warehouseId: warehouse.id,
          type: "RECEIPT",
          quantity: 10,
          reason: "smoke test receipt",
          referenceType: "GOODS_RECEIPT",
          referenceId: createdReceipt.id,
          actorId: actor.id,
        },
      });
      return createdReceipt;
    },
    { isolationLevel: "Serializable" },
  );

  const smokeMovement = await prisma.stockMovement.aggregate({
    where: { productId: product.id, referenceType: "GOODS_RECEIPT", referenceId: receipt.id },
    _sum: { quantity: true },
  });

  const receiptWithLines = await prisma.goodsReceipt.findUnique({
    where: { id: receipt.id },
    include: { lines: true },
  });

  if (!receiptWithLines || receiptWithLines.lines.length !== 1 || smokeMovement._sum.quantity !== 10) {
    throw new Error("stock round-trip failed");
  }

  console.log(
    `SMOKE OK: product=${product.name} warehouse=${warehouse.name} actor=${actor.email} receiptLines=${receiptWithLines.lines.length} receiptQty=${smokeMovement._sum.quantity}`,
  );
}

main()
  .catch((error) => {
    console.error("SMOKE FAILED:", error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
