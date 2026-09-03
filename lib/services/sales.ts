import {
  prisma,
  isForeignKeyConstraint,
  isSerializationConflict,
  isUniqueConstraint,
  lockProductRows,
  runSerializableTransaction,
} from "@/lib/db";
import { ServiceError } from "@/lib/service-errors";
import { saleFingerprint } from "@/lib/idempotency";
import { deriveStockByProduct } from "@/lib/services/stock";

export type SaleLineInput = {
  productId: string;
  quantity: number;
  unitPriceRial: bigint;
};

export type SaleInput = {
  saleNo: string;
  customerId?: string | null;
  lines: SaleLineInput[];
};

type StoredSaleLine = {
  productId: string;
  quantity: number;
  unitPriceRial: bigint;
};

export async function findSaleWithLines(saleNo: string) {
  return prisma.sale.findUnique({
    where: { saleNo },
    include: { lines: { select: { productId: true, quantity: true, unitPriceRial: true } } },
  });
}

/**
 * Replays an existing sale. Same normalized payload → the stored document;
 * different payload → IDEMPOTENCY_CONFLICT. Never mutates stored documents.
 */
export async function replayOrConflictSale(
  existing: { id: string; saleNo: string; customerId: string | null; lines: StoredSaleLine[] },
  incoming: SaleInput,
): Promise<{ id: string; saleNo: string }> {
  const storedFingerprint = saleFingerprint({
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

  if (storedFingerprint !== incomingFingerprint) throw new ServiceError("IDEMPOTENCY_CONFLICT");
  return { id: existing.id, saleNo: existing.saleNo };
}

/**
 * Idempotent sale recording: same number + same payload → the stored document
 * (created=false); different payload → IDEMPOTENCY_CONFLICT; new number →
 * created=true. Locks product rows → derives stock from the ledger → rejects
 * any line below zero → writes sale + SALE movements (default warehouse) in
 * one serializable transaction with bounded retry.
 */
export async function recordSale(
  input: SaleInput,
  actorId: string,
): Promise<{ id: string; saleNo: string; created: boolean }> {
  const existing = await findSaleWithLines(input.saleNo);
  if (existing) return { ...(await replayOrConflictSale(existing, input)), created: false };

  try {
    const sale = await runSerializableTransaction(async (transaction) => {
    const defaultWarehouse = await transaction.warehouse.findFirst({ where: { isDefault: true } });
    if (!defaultWarehouse) throw new ServiceError("NO_DEFAULT_WAREHOUSE");

    await lockProductRows(transaction, input.lines.map((line) => line.productId));

    const products = await transaction.product.findMany({
      where: { id: { in: input.lines.map((line) => line.productId) }, isActive: true },
      select: { id: true },
    });
    const knownProducts = new Set(products.map((product) => product.id));
    for (const line of input.lines) {
      if (!knownProducts.has(line.productId)) throw new ServiceError("PRODUCT_NOT_FOUND");
    }

    const stockByProduct = await deriveStockByProduct(
      transaction,
      input.lines.map((line) => line.productId),
    );
    for (const line of input.lines) {
      if ((stockByProduct.get(line.productId) ?? 0) < line.quantity) {
        throw new ServiceError("INSUFFICIENT_STOCK");
      }
    }

    const totalRial = input.lines.reduce(
      (total, line) => total + BigInt(line.quantity) * line.unitPriceRial,
      BigInt(0),
    );

    const createdSale = await transaction.sale.create({
      data: {
        saleNo: input.saleNo,
        customerId: input.customerId ?? null,
        soldBy: actorId,
        totalRial,
        lines: {
          create: input.lines.map((line) => ({
            productId: line.productId,
            quantity: line.quantity,
            unitPriceRial: line.unitPriceRial,
          })),
        },
      },
    });

    await transaction.stockMovement.createMany({
      data: input.lines.map((line) => ({
        productId: line.productId,
        warehouseId: defaultWarehouse.id,
        type: "SALE" as const,
        quantity: line.quantity,
        reason: "Sale completed",
        referenceId: createdSale.id,
        referenceType: "SALE",
        actorId,
      })),
    });

    return createdSale;
  });

  return { id: sale.id, saleNo: sale.saleNo, created: true };
  } catch (error) {
    if (isUniqueConstraint(error)) {
      // Lost a creation race: decide replay vs conflict from the stored row.
      const stored = await findSaleWithLines(input.saleNo);
      if (stored) return { ...(await replayOrConflictSale(stored, input)), created: false };
      throw new ServiceError("IDEMPOTENCY_CONFLICT");
    }
    if (isForeignKeyConstraint(error)) throw new ServiceError("INVALID_REFERENCE");
    if (isSerializationConflict(error)) throw new ServiceError("SERIALIZATION_RETRY_EXHAUSTED");
    throw error;
  }
}

export { isUniqueConstraint };
