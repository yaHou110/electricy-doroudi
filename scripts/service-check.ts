import "dotenv/config";
import { prisma } from "@/lib/db";
import { ServiceError } from "@/lib/service-errors";
import { receiveGoods } from "@/lib/services/receiving";
import { recordSale } from "@/lib/services/sales";

async function main() {
  const product = await prisma.product.findUniqueOrThrow({ where: { sku: "SCH-LC1D25" } });
  const manager = await prisma.user.findUniqueOrThrow({ where: { email: "manager@doroudi.local" } });

  console.log("--- 1. receiving service: create + replay + conflict ---");
  // Self-healing cleanup: remove any leftovers from an interrupted earlier run first.
  for (const no of ["SVC-TEST-1", "SVC-SALE-1", "SVC-SALE-2"]) {
    const receipts = await prisma.goodsReceipt.findMany({ where: { receiptNo: no } });
    for (const receipt of receipts) {
      await prisma.stockMovement.deleteMany({ where: { referenceType: "GOODS_RECEIPT", referenceId: receipt.id } });
      await prisma.goodsReceipt.delete({ where: { id: receipt.id } });
    }
    const sales = await prisma.sale.findMany({ where: { saleNo: no } });
    for (const sale of sales) {
      await prisma.stockMovement.deleteMany({ where: { referenceType: "SALE", referenceId: sale.id } });
      await prisma.sale.delete({ where: { id: sale.id } });
    }
  }

  const received = await receiveGoods(
    { receiptNo: "SVC-TEST-1", lines: [{ productId: product.id, quantity: 5, unitCostRial: 1000n }] },
    manager.id,
  );
  console.log("created:", received.receiptNo);

  const warehouseId = (
    await prisma.stockMovement.findFirstOrThrow({ where: { referenceId: received.id }, select: { warehouseId: true } })
  ).warehouseId;
  if (!warehouseId) throw new Error("warehouseId NOT set on movement");
  console.log("warehouseId stamped:", warehouseId);

  const replay = await receiveGoods(
    { receiptNo: "SVC-TEST-1", lines: [{ productId: product.id, quantity: 5, unitCostRial: 1000n }] },
    manager.id,
  );
  if (replay.id !== received.id) throw new Error("replay returned different document");
  console.log("replay safe");

  let conflict = false;
  try {
    await receiveGoods(
      { receiptNo: "SVC-TEST-1", lines: [{ productId: product.id, quantity: 9, unitCostRial: 1000n }] },
      manager.id,
    );
  } catch (error) {
    conflict = error instanceof ServiceError && error.code === "IDEMPOTENCY_CONFLICT";
  }
  if (!conflict) throw new Error("conflict not detected");
  console.log("conflict detected");

  const movements = await prisma.stockMovement.count({ where: { referenceId: received.id } });
  if (movements !== 1) throw new Error(`expected 1 movement after replay, got ${movements}`);

  console.log("--- 2. sales service: stock check + insufficient ---");

  const sold = await recordSale(
    { saleNo: "SVC-SALE-1", lines: [{ productId: product.id, quantity: 2, unitPriceRial: 2000n }] },
    manager.id,
  );
  console.log("sold:", sold.saleNo);

  let insufficient = false;
  try {
    await recordSale(
      { saleNo: "SVC-SALE-2", lines: [{ productId: product.id, quantity: 10_000_000, unitPriceRial: 1n }] },
      manager.id,
    );
  } catch (error) {
    insufficient = error instanceof ServiceError && error.code === "INSUFFICIENT_STOCK";
  }
  if (!insufficient) throw new Error("insufficient stock not detected");
  console.log("insufficient stock rejected");

  console.log("--- 3. cleanup ---");
  await prisma.stockMovement.deleteMany({ where: { referenceType: "SALE", referenceId: sold.id } });
  await prisma.sale.delete({ where: { id: sold.id } });
  await prisma.stockMovement.deleteMany({ where: { referenceType: "GOODS_RECEIPT", referenceId: received.id } });
  await prisma.goodsReceipt.delete({ where: { id: received.id } });

  console.log("SERVICE TESTS PASSED");
}

main()
  .catch((error) => {
    console.error("SERVICE TESTS FAILED:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
