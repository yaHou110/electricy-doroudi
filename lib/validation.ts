import { z } from "zod";

const uuid = z.string().uuid();
const maxSafeInteger = Number.MAX_SAFE_INTEGER;
const maxPostgresInt = 2147483647;
const positiveInteger = z.number().int().positive().max(maxPostgresInt);
const nonNegativeInteger = z.number().int().nonnegative().max(maxPostgresInt);
const maxPostgresBigInt = BigInt("9223372036854775807");

const nonNegativeMoney = z.union([
  z.number().int().nonnegative().max(maxSafeInteger).transform((value) => BigInt(value)),
  z.string().trim().max(19).regex(/^\d+$/).transform((value) => BigInt(value)),
]).pipe(z.bigint().max(maxPostgresBigInt));

export const productInputSchema = z.object({
  sku: z.string().trim().min(1).max(80),
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(2000).optional(),
  unit: z.string().trim().min(1).max(24).default("عدد"),
  attributes: z.record(z.string(), z.unknown()).optional(),
  costPriceRial: nonNegativeMoney,
  salePriceRial: nonNegativeMoney,
  reorderPoint: nonNegativeInteger.default(0),
  brandId: uuid.nullable().optional(),
  categoryId: uuid.nullable().optional(),
});

export const customerInputSchema = z.object({
  name: z.string().trim().min(2).max(160),
  phone: z.string().trim().max(24).optional(),
  companyName: z.string().trim().max(160).optional(),
  type: z.enum(["RETAILER", "CONTRACTOR", "COMPANY", "OTHER"]).default("RETAILER"),
  paymentTermsDays: nonNegativeInteger.max(365).default(0),
  creditLimitRial: nonNegativeMoney.optional().transform((value) => value ?? BigInt(0)),
  notes: z.string().trim().max(1000).optional(),
});

const receiptLineSchema = z.object({
  productId: uuid,
  quantity: positiveInteger,
  unitCostRial: nonNegativeMoney,
});

const saleLineSchema = z.object({
  productId: uuid,
  quantity: positiveInteger,
  unitPriceRial: nonNegativeMoney,
});

function rejectDuplicateProducts(
  lines: Array<{ productId: string }>,
  context: z.RefinementCtx,
) {
  const productIds = new Set<string>();
  lines.forEach((line, index) => {
    if (productIds.has(line.productId)) {
      context.addIssue({
        code: "custom",
        path: ["lines", index, "productId"],
        message: "Each product may appear only once per document.",
      });
    }
    productIds.add(line.productId);
  });
}

export const receiptInputSchema = z.object({
  receiptNo: z.string().trim().min(1).max(40),
  supplierId: uuid.nullable().optional(),
  notes: z.string().trim().max(1000).optional(),
  lines: z.array(receiptLineSchema).min(1),
}).superRefine(({ lines }, context) => rejectDuplicateProducts(lines, context));

export const saleInputSchema = z.object({
  saleNo: z.string().trim().min(1).max(40),
  customerId: uuid.nullable().optional(),
  lines: z.array(saleLineSchema).min(1),
}).superRefine(({ lines }, context) => rejectDuplicateProducts(lines, context));
