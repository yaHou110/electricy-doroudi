import { describe, expect, it } from "vitest";
import { linesFingerprint, receiptFingerprint, saleFingerprint } from "./idempotency";

describe("idempotency fingerprints", () => {
  const firstProduct = "00000000-0000-0000-0000-000000000001";
  const secondProduct = "00000000-0000-0000-0000-000000000002";

  it("does not change when document lines arrive in a different order", () => {
    const first = linesFingerprint([
      { productId: secondProduct, quantity: 2, price: BigInt("20000000000000001") },
      { productId: firstProduct, quantity: 1, price: "100" },
    ]);
    const second = linesFingerprint([
      { productId: firstProduct, quantity: 1, price: 100 },
      { productId: secondProduct, quantity: 2, price: "20000000000000001" },
    ]);

    expect(first).toBe(second);
  });

  it("distinguishes changed receipt metadata or sale customer", () => {
    const lines = [{ productId: firstProduct, quantity: 1, price: 100 }];

    expect(receiptFingerprint({ supplierId: null, notes: "a", lines })).not.toBe(
      receiptFingerprint({ supplierId: null, notes: "b", lines }),
    );
    expect(saleFingerprint({ customerId: firstProduct, lines })).not.toBe(
      saleFingerprint({ customerId: secondProduct, lines }),
    );
  });
});
