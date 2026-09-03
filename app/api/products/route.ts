import { NextResponse } from "next/server";
import { prisma, isForeignKeyConstraint, isUniqueConstraint } from "@/lib/db";
import { productInputSchema } from "@/lib/validation";
import { serializeForJson } from "@/lib/serialize";
import { authorize } from "@/lib/authz";
import { errorResponse, readJson } from "@/lib/http";
import type { Prisma } from "@prisma/client";

export async function GET() {
  const authorization = await authorize(["MANAGER", "WAREHOUSE", "SALES"]);
  if (!authorization.ok) {
    return errorResponse(
      authorization.status,
      authorization.status === 401 ? "UNAUTHENTICATED" : "FORBIDDEN",
      authorization.status === 401 ? "ورود به سیستم الزامی است." : "دسترسی لازم را ندارید.",
    );
  }

  const products = await prisma.product.findMany({
    where: { isActive: true },
    include: { brand: true, category: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(serializeForJson(products), {
    headers: { "Cache-Control": "private, max-age=30" },
  });
}

export async function POST(request: Request) {
  const authorization = await authorize(["MANAGER"]);
  if (!authorization.ok) {
    return errorResponse(
      authorization.status,
      authorization.status === 401 ? "UNAUTHENTICATED" : "FORBIDDEN",
      authorization.status === 401 ? "ورود به سیستم الزامی است." : "دسترسی لازم برای ثبت کالا را ندارید.",
    );
  }

  const body = await readJson(request);
  if (!body.ok) return errorResponse(400, "INVALID_JSON", "بدنه درخواست معتبر نیست.");

  const parsed = productInputSchema.safeParse(body.data);
  if (!parsed.success) {
    return errorResponse(400, "VALIDATION_ERROR", "اطلاعات کالا معتبر نیست.", parsed.error.flatten());
  }

  const { brandId, categoryId, attributes, ...rest } = parsed.data;

  try {
    const product = await prisma.$transaction(async (transaction) => {
      const createdProduct = await transaction.product.create({
        data: {
          ...rest,
          attributes: (attributes ?? undefined) as Prisma.InputJsonValue | undefined,
          brandId: brandId ?? null,
          categoryId: categoryId ?? undefined,
        },
      });

      await transaction.productPriceHistory.create({
        data: {
          productId: createdProduct.id,
          purchasePriceRial: createdProduct.costPriceRial,
          salePriceRial: createdProduct.salePriceRial,
          reason: "Initial product creation",
          changedById: authorization.user.id,
        },
      });

      return createdProduct;
    });

    return NextResponse.json(serializeForJson(product), { status: 201 });
  } catch (error) {
    if (isUniqueConstraint(error)) {
      return errorResponse(409, "PRODUCT_SKU_EXISTS", "کد کالا قبلاً ثبت شده است.");
    }
    if (isForeignKeyConstraint(error)) {
      return errorResponse(400, "INVALID_REFERENCE", "برند یا دسته‌بندی معتبر نیست.");
    }
    return errorResponse(500, "PRODUCT_CREATE_FAILED", "ثبت کالا انجام نشد.");
  }
}
