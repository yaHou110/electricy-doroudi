import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const product = await prisma.product.findUnique({ where: { sku: "SCH-LC1D25" } });
  if (!product) throw new Error("seeded product missing");

  const warehouse = await prisma.warehouse.findFirst({ where: { isDefault: true } });
  if (!warehouse) throw new Error("default warehouse missing");

  const actor = await prisma.user.findUnique({ where: { email: "manager@droudian.local" } });
  if (!actor) throw new Error("seeded user missing");

  // Remove any previous smoke-run data so the script is rerunnable.
  await prisma.stockMovement.deleteMany({
    where: { referenceType: "GoodsReceipt", referenceId: "SMOKE-1" },
  });
  await prisma.goodsReceipt.deleteMany({ where: { receiptNo: "SMOKE-1" } });

  // Transactional write path mirroring the receiving route shape.
  await prisma.$transaction(
    async (tx) => {
      await tx.goodsReceipt.create({
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
          referenceType: "GoodsReceipt",
          referenceId: "SMOKE-1",
          actorId: actor.id,
        },
      });
    },
    { isolationLevel: "Serializable" },
  );

  const movements = await prisma.stockMovement.aggregate({
    where: { productId: product.id, type: "RECEIPT" },
    _sum: { quantity: true },
  });

  const receipt = await prisma.goodsReceipt.findUnique({
    where: { receiptNo: "SMOKE-1" },
    include: { lines: true },
  });

  if (!receipt || movements._sum.quantity !== 10) throw new Error("stock round-trip failed");

  console.log(
    `SMOKE OK: product=${product.name} warehouse=${warehouse.name} actor=${actor.email} receiptLines=${receipt.lines.length} receiptQty=${movements._sum.quantity}`,
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
