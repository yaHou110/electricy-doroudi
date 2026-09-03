import type { Prisma } from "@prisma/client";

export const INBOUND_MOVEMENT_TYPES = ["RECEIPT", "ADJUSTMENT_IN", "RETURN_IN"] as const;

export function isInboundMovement(type: string): boolean {
  return (INBOUND_MOVEMENT_TYPES as readonly string[]).includes(type);
}

/**
 * Derives current system-wide stock for the given products from the immutable
 * ledger. Must be called inside the same transaction that holds the product
 * row locks, so the derived numbers cannot change underneath the caller.
 */
export async function deriveStockByProduct(
  transaction: Prisma.TransactionClient,
  productIds: string[],
): Promise<Map<string, number>> {
  if (productIds.length === 0) return new Map();

  const movements = await transaction.stockMovement.groupBy({
    by: ["productId", "type"],
    where: { productId: { in: productIds } },
    _sum: { quantity: true },
  });

  const stock = new Map<string, number>();
  for (const movement of movements) {
    const signed = isInboundMovement(movement.type)
      ? movement._sum.quantity ?? 0
      : -(movement._sum.quantity ?? 0);
    stock.set(movement.productId, (stock.get(movement.productId) ?? 0) + signed);
  }
  return stock;
}
