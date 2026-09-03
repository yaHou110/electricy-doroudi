export type IdempotencyLine = {
  productId: string;
  quantity: number;
  price: number | bigint | string;
};

type DocumentFingerprintInput = {
  supplierId?: string | null;
  customerId?: string | null;
  notes?: string | null;
  lines: IdempotencyLine[];
};

function normalizedLines(lines: IdempotencyLine[]) {
  return lines
    .map(({ productId, quantity, price }) => ({
      productId,
      quantity,
      price: String(price),
    }))
    .sort((left, right) => {
      if (left.productId < right.productId) return -1;
      if (left.productId > right.productId) return 1;
      if (left.quantity !== right.quantity) return left.quantity - right.quantity;
      if (left.price < right.price) return -1;
      if (left.price > right.price) return 1;
      return 0;
    });
}

export function linesFingerprint(lines: IdempotencyLine[]): string {
  return JSON.stringify(normalizedLines(lines));
}

function documentFingerprint(input: DocumentFingerprintInput): string {
  return JSON.stringify({
    supplierId: input.supplierId ?? null,
    customerId: input.customerId ?? null,
    notes: input.notes ?? null,
    lines: normalizedLines(input.lines),
  });
}

export function receiptFingerprint(input: {
  supplierId?: string | null;
  notes?: string | null;
  lines: IdempotencyLine[];
}): string {
  return documentFingerprint(input);
}

export function saleFingerprint(input: {
  customerId?: string | null;
  lines: IdempotencyLine[];
}): string {
  return documentFingerprint(input);
}
