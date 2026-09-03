import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { productInputSchema } from "@/lib/validation";
import { serializeForJson } from "@/lib/serialize";
import { requireRole } from "@/lib/authz";
import type { Prisma } from "@prisma/client";

export async function GET() {
  const user = await requireRole(["MANAGER", "WAREHOUSE", "SALES"]);
  if (!user) return NextResponse.json({ error: "ورود به سیستم الزامی است." }, { status: 401 });

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
  const user = await requireRole(["MANAGER"]);
  if (!user) return NextResponse.json({ error: "دسترسی لازم برای ثبت کالا را ندارید." }, { status: 403 });

  const parsed = productInputSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "اطلاعات کالا معتبر نیست.", details: parsed.error.flatten() }, { status: 400 });
  }

  const { brandId, categoryId, attributes, ...rest } = parsed.data;
  const product = await prisma.product.create({
    data: {
      ...rest,
      attributes: (attributes ?? undefined) as Prisma.InputJsonValue | undefined,
      brandId: brandId ?? null,
      categoryId: categoryId ?? undefined,
    },
  });

  await prisma.productPriceHistory.create({
    data: {
      productId: product.id,
      purchasePriceRial: product.costPriceRial,
      salePriceRial: product.salePriceRial,
      reason: "Initial product creation",
      changedById: user.id,
    },
  });

  return NextResponse.json(serializeForJson(product), { status: 201 });
}
