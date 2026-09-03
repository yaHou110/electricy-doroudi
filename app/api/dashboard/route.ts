import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/authz";

export const dynamic = "force-dynamic";

function toNumber(value: bigint | number | null | undefined): number {
  return Number(value ?? 0);
}

export async function GET() {
  const user = await requireRole(["MANAGER", "WAREHOUSE", "SALES"]);
  if (!user) return NextResponse.json({ error: "ورود به سیستم الزامی است." }, { status: 401 });

  const [products, recentReceipts, recentSales, movementCount] = await Promise.all([
    prisma.product.findMany({
      where: { isActive: true },
      include: { brand: true, category: true, movements: { select: { type: true, quantity: true } } },
      orderBy: { updatedAt: "desc" },
      take: 8,
    }),
    prisma.goodsReceipt.findMany({
      orderBy: { createdAt: "desc" },
      take: 4,
      include: { supplier: true },
    }),
    prisma.sale.findMany({
      orderBy: { soldAt: "desc" },
      take: 4,
      include: { customer: true },
    }),
    prisma.stockMovement.count(),
  ]);

  const stockProducts = products.map((product) => {
    const stock = product.movements.reduce((total, movement) => {
      const incoming = ["RECEIPT", "ADJUSTMENT_IN", "RETURN_IN"].includes(movement.type);
      return total + (incoming ? movement.quantity : -movement.quantity);
    }, 0);

    return {
      id: product.id,
      sku: product.sku,
      name: product.name,
      unit: product.unit,
      brand: product.brand?.name ?? "بدون برند",
      category: product.category?.name ?? "بدون دسته‌بندی",
      stock,
      reorderPoint: product.reorderPoint,
      salePriceRial: toNumber(product.salePriceRial),
    };
  });

  const lowStock = stockProducts.filter((product) => product.stock <= product.reorderPoint).length;
  const totalInventoryValue = stockProducts.reduce((sum, product) => sum + product.stock * product.salePriceRial, 0);
  const salesToday = recentSales.filter((sale) => {
    const date = new Date(sale.soldAt);
    const today = new Date();
    return date.toDateString() === today.toDateString();
  }).reduce((sum, sale) => sum + toNumber(sale.totalRial), 0);

  return NextResponse.json({
    metrics: {
      productCount: products.length,
      lowStock,
      movementCount,
      salesToday,
      totalInventoryValue,
    },
    products: stockProducts,
    recentReceipts: recentReceipts.map((receipt) => ({
      receiptNo: receipt.receiptNo,
      supplier: receipt.supplier?.name ?? "تأمین‌کننده ثبت نشده",
      createdAt: receipt.createdAt,
    })),
    recentSales: recentSales.map((sale) => ({
      saleNo: sale.saleNo,
      customer: sale.customer?.companyName ?? sale.customer?.name ?? "مشتری آزاد",
      totalRial: toNumber(sale.totalRial),
      soldAt: sale.soldAt,
    })),
  });
}
