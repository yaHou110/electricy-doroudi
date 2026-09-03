import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { authorize } from "@/lib/authz";
import { errorResponse } from "@/lib/http";
import { serializeForJson } from "@/lib/serialize";

export const dynamic = "force-dynamic";

const inboundMovementTypes = ["RECEIPT", "ADJUSTMENT_IN", "RETURN_IN"];

export async function GET() {
  const authorization = await authorize(["MANAGER", "WAREHOUSE", "SALES"]);
  if (!authorization.ok) {
    return errorResponse(
      authorization.status,
      authorization.status === 401 ? "UNAUTHENTICATED" : "FORBIDDEN",
      authorization.status === 401 ? "ورود به سیستم الزامی است." : "دسترسی لازم را ندارید.",
    );
  }

  const startOfToday = new Date();
  startOfToday.setUTCHours(0, 0, 0, 0);

  const [products, recentReceipts, recentSales, salesToday, movementCount] = await Promise.all([
    prisma.product.findMany({
      where: { isActive: true },
      include: { brand: true, category: true, movements: { select: { type: true, quantity: true } } },
      orderBy: { updatedAt: "desc" },
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
    prisma.sale.findMany({
      where: { soldAt: { gte: startOfToday }, status: "COMPLETED" },
      select: { totalRial: true },
    }),
    prisma.stockMovement.count(),
  ]);

  const stockProducts = products.map((product) => {
    const stock = product.movements.reduce((total, movement) => {
      const incoming = inboundMovementTypes.includes(movement.type);
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
      salePriceRial: product.salePriceRial,
    };
  });

  const lowStock = stockProducts.filter((product) => product.stock <= product.reorderPoint).length;
  const totalStock = stockProducts.reduce((sum, product) => sum + product.stock, 0);
  const totalInventoryValue = stockProducts.reduce(
    (sum, product) => sum + BigInt(product.stock) * product.salePriceRial,
    BigInt(0),
  );
  const salesTodayTotal = salesToday.reduce((sum, sale) => sum + sale.totalRial, BigInt(0));

  return NextResponse.json(serializeForJson({
    metrics: {
      productCount: products.length,
      lowStock,
      totalStock,
      movementCount,
      salesToday: salesTodayTotal,
      totalInventoryValue,
    },
    // The UI displays the eight most recently updated products; metrics above cover all active products.
    products: stockProducts.slice(0, 8),
    recentReceipts: recentReceipts.map((receipt) => ({
      receiptNo: receipt.receiptNo,
      supplier: receipt.supplier?.name ?? "تأمین‌کننده ثبت نشده",
      createdAt: receipt.createdAt,
    })),
    recentSales: recentSales.map((sale) => ({
      saleNo: sale.saleNo,
      customer: sale.customer?.companyName ?? sale.customer?.name ?? "مشتری آزاد",
      totalRial: sale.totalRial,
      soldAt: sale.soldAt,
    })),
  }));
}
