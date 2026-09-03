import {
  prisma,
  isForeignKeyConstraint,
  isSerializationConflict,
  isUniqueConstraint,
  lockProductRows,
  runSerializableTransaction,
} from "@/lib/db";
import { ServiceError } from "@/lib/service-errors";
import { receiptFingerprint } from "@/lib/idempotency";

export type ReceiveLineInput = {
  productId: string;
  quantity: number;
  unitCostRial: bigint;
};

export type ReceiveInput = {
  receiptNo: string;
  supplierId?: string | null;
  notes?: string | null;
  lines: ReceiveLineInput[];
};

type StoredReceiptLine = {
  productId: string;
  quantity: number;
  unitCostRial: bigint;
};

export async function findReceiptWithLines(receiptNo: string) {
  return prisma.goodsReceipt.findUnique({
    where: { receiptNo },
    include: { lines: { select: { productId: true, quantity: true, unitCostRial: true } } },
  });
}

/**
 * Replays an existing receipt. Same normalized payload → the stored document;
 * different payload → IDEMPOTENCY_CONFLICT. Never mutates stored documents.
 */
export async function replayOrConflictReceipt(
  existing: { id: string; receiptNo: string; supplierId: string | null; notes: string | null; lines: StoredReceiptLine[] },
  incoming: ReceiveInput,
): Promise<{ id: string; receiptNo: string }> {
  const storedFingerprint = receiptFingerprint({
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

  if (storedFingerprint !== incomingFingerprint) throw new ServiceError("IDEMPOTENCY_CONFLICT");
  return { id: existing.id, receiptNo: existing.receiptNo };
}

/**
 * Idempotent goods receiving: same number + same payload → the stored document
 * (created=false); different payload → IDEMPOTENCY_CONFLICT; new number →
 * created=true. Owning the full semantics here keeps every caller safe
 * (routes, scripts, future jobs). Locks product rows first (deterministic
 * order, uuid-cast), then writes document + ledger in one serializable
 * transaction with bounded retry. Movements are stamped with the default
 * warehouse.
 */
export async function receiveGoods(
  input: ReceiveInput,
  actorId: string,
): Promise<{ id: string; receiptNo: string; created: boolean }> {
  const existing = await findReceiptWithLines(input.receiptNo);
  if (existing) return { ...(await replayOrConflictReceipt(existing, input)), created: false };

  try {
    const receipt = await runSerializableTransaction(async (transaction) => {
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

    const createdReceipt = await transaction.goodsReceipt.create({
      data: {
        receiptNo: input.receiptNo,
        supplierId: input.supplierId ?? null,
        receivedBy: actorId,
        notes: input.notes ?? null,
        lines: {
          create: input.lines.map((line) => ({
            productId: line.productId,
            quantity: line.quantity,
            unitCostRial: line.unitCostRial,
          })),
        },
      },
    });

    await transaction.stockMovement.createMany({
      data: input.lines.map((line) => ({
        productId: line.productId,
        warehouseId: defaultWarehouse.id,
        type: "RECEIPT" as const,
        quantity: line.quantity,
        reason: "Goods received",
        referenceId: createdReceipt.id,
        referenceType: "GOODS_RECEIPT",
        actorId,
      })),
    });

    return createdReceipt;
  });

  return { id: receipt.id, receiptNo: receipt.receiptNo, created: true };
  } catch (error) {
    if (isUniqueConstraint(error)) {
      // Lost a creation race: decide replay vs conflict from the stored row.
      const stored = await findReceiptWithLines(input.receiptNo);
      if (stored) return { ...(await replayOrConflictReceipt(stored, input)), created: false };
      throw new ServiceError("IDEMPOTENCY_CONFLICT");
    }
    if (isForeignKeyConstraint(error)) throw new ServiceError("INVALID_REFERENCE");
    if (isSerializationConflict(error)) throw new ServiceError("SERIALIZATION_RETRY_EXHAUSTED");
    throw error;
  }
}

export { isUniqueConstraint };
