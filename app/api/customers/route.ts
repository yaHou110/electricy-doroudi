import { NextResponse } from "next/server";
import { prisma, isForeignKeyConstraint, isUniqueConstraint } from "@/lib/db";
import { customerInputSchema } from "@/lib/validation";
import { serializeForJson } from "@/lib/serialize";
import { authorize } from "@/lib/authz";
import { errorResponse, readJson } from "@/lib/http";

export async function GET() {
  const authorization = await authorize(["MANAGER", "SALES"]);
  if (!authorization.ok) {
    return errorResponse(
      authorization.status,
      authorization.status === 401 ? "UNAUTHENTICATED" : "FORBIDDEN",
      authorization.status === 401 ? "ورود به سیستم الزامی است." : "دسترسی لازم را ندارید.",
    );
  }

  const customers = await prisma.customer.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json(serializeForJson(customers));
}

export async function POST(request: Request) {
  const authorization = await authorize(["MANAGER", "SALES"]);
  if (!authorization.ok) {
    return errorResponse(
      authorization.status,
      authorization.status === 401 ? "UNAUTHENTICATED" : "FORBIDDEN",
      authorization.status === 401 ? "ورود به سیستم الزامی است." : "دسترسی لازم برای ثبت مشتری را ندارید.",
    );
  }

  const body = await readJson(request);
  if (!body.ok) return errorResponse(400, "INVALID_JSON", "بدنه درخواست معتبر نیست.");

  const parsed = customerInputSchema.safeParse(body.data);
  if (!parsed.success) {
    return errorResponse(400, "VALIDATION_ERROR", "اطلاعات مشتری معتبر نیست.", parsed.error.flatten());
  }

  try {
    const customer = await prisma.customer.create({ data: parsed.data });
    return NextResponse.json(serializeForJson(customer), { status: 201 });
  } catch (error) {
    if (isUniqueConstraint(error)) return errorResponse(409, "CUSTOMER_EXISTS", "مشتری تکراری است.");
    if (isForeignKeyConstraint(error)) return errorResponse(400, "INVALID_REFERENCE", "اطلاعات ارجاعی معتبر نیست.");
    return errorResponse(500, "CUSTOMER_CREATE_FAILED", "ثبت مشتری انجام نشد.");
  }
}
