import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { customerInputSchema } from "@/lib/validation";
import { serializeForJson } from "@/lib/serialize";
import { requireRole } from "@/lib/authz";

export async function GET() {
  const user = await requireRole(["MANAGER", "SALES"]);
  if (!user) return NextResponse.json({ error: "ورود به سیستم الزامی است." }, { status: 401 });

  const customers = await prisma.customer.findMany({
    orderBy: { name: "asc" },
  });

  return NextResponse.json(serializeForJson(customers));
}

export async function POST(request: Request) {
  const user = await requireRole(["MANAGER", "SALES"]);
  if (!user) return NextResponse.json({ error: "دسترسی لازم برای ثبت مشتری را ندارید." }, { status: 403 });

  const parsed = customerInputSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "اطلاعات مشتری معتبر نیست.", details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const customer = await prisma.customer.create({ data: parsed.data });
    return NextResponse.json(serializeForJson(customer), { status: 201 });
  } catch {
    return NextResponse.json({ error: "ثبت مشتری انجام نشد." }, { status: 409 });
  }
}
