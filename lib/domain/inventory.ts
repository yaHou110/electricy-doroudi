export type StockMovement = {
  productId: string;
  quantity: number;
  direction: "IN" | "OUT";
};

export type StockOperation = {
  productId: string;
  quantity: number;
  direction: "IN" | "OUT";
};

export function calculateStock(movements: StockMovement[], productId: string): number {
  return movements
    .filter((movement) => movement.productId === productId)
    .reduce(
      (stock, movement) =>
        stock + (movement.direction === "IN" ? movement.quantity : -movement.quantity),
      0,
    );
}

export function validateStockOperation(
  currentStock: number,
  operation: StockOperation,
): { ok: true } | { ok: false; reason: string } {
  if (!Number.isSafeInteger(operation.quantity) || operation.quantity <= 0) {
    return { ok: false, reason: "Quantity must be a positive integer." };
  }

  if (operation.direction === "OUT" && operation.quantity > currentStock) {
    return { ok: false, reason: "Insufficient stock for this operation." };
  }

  return { ok: true };
}

export function movementSignedQuantity(movement: StockMovement): number {
  return movement.direction === "IN" ? movement.quantity : -movement.quantity;
}
