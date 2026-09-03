import { describe, expect, it } from "vitest";
import { calculateStock, validateStockOperation } from "./inventory";

describe("inventory domain", () => {
  it("calculates stock from signed movements", () => {
    const stock = calculateStock(
      [
        { productId: "a", quantity: 12, direction: "IN" },
        { productId: "a", quantity: 4, direction: "OUT" },
        { productId: "b", quantity: 100, direction: "IN" },
      ],
      "a",
    );

    expect(stock).toBe(8);
  });

  it("rejects a sale larger than current stock", () => {
    expect(validateStockOperation(5, { productId: "a", quantity: 6, direction: "OUT" })).toEqual({
      ok: false,
      reason: "Insufficient stock for this operation.",
    });
  });

  it("rejects zero and fractional quantities", () => {
    expect(validateStockOperation(5, { productId: "a", quantity: 0, direction: "IN" }).ok).toBe(false);
    expect(validateStockOperation(5, { productId: "a", quantity: 1.5, direction: "IN" }).ok).toBe(false);
  });
});
