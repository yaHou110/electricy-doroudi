import { z } from "zod";

const uuid = z.string().uuid();
const positiveInteger = z.number().int().positive();

export const productInputSchema = z.object({
  sku: z.string().trim().min(1).max(80),
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(2000).optional(),
  unit: z.string().trim().min(1).max(24).default("عدد"),
  attributes: z.record(z.string(), z.unknown()).optional(),
  costPriceRial: z.number().int().nonnegative(),
  salePriceRial: z.number().int().nonnegative(),
  reorderPoint: z.number().int().nonnegative().default(0),
  brandId: uuid.nullable().optional(),
  categoryId: uuid.nullable().optional(),
});

export const customerInputSchema = z.object({
  name: z.string().trim().min(2).max(160),
  phone: z.string().trim().max(24).optional(),
  companyName: z.string().trim().max(160).optional(),
  type: z.enum(["RETAILER", "CONTRACTOR", "COMPANY", "OTHER"]).default("RETAILER"),
  paymentTermsDays: z.number().int().min(0).max(365).default(0),
  creditLimitRial: z.number().int().nonnegative().default(0),
  notes: z.string().trim().max(1000).optional(),
});

export const receiptInputSchema = z.object({
  receiptNo: z.string().trim().min(1).max(40),
  supplierId: uuid.nullable().optional(),
  notes: z.string().trim().max(1000).optional(),
  lines: z.array(
    z.object({
      productId: uuid,
      quantity: positiveInteger,
      unitCostRial: z.number().int().nonnegative(),
    }),
  ).min(1),
});

export const saleInputSchema = z.object({
  saleNo: z.string().trim().min(1).max(40),
  customerId: uuid.nullable().optional(),
  lines: z.array(
    z.object({
      productId: uuid,
      quantity: positiveInteger,
      unitPriceRial: z.number().int().nonnegative(),
    }),
  ).min(1),
});
