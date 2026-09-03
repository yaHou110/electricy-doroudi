import { NextResponse } from "next/server";
import { receiptInputSchema } from "@/lib/validation";
import { authorize } from "@/lib/authz";
import { errorResponse, readJson } from "@/lib/http";
import { ServiceError } from "@/lib/service-errors";
import { receiveGoods } from "@/lib/services/receiving";

function serviceErrorResponse(error: unknown, fallbackCode: string, fallbackMessage: string) {
  if (error instanceof ServiceError) {
    switch (error.code) {
      case "PRODUCT_NOT_FOUND":
        return errorResponse(400, "PRODUCT_NOT_FOUND", "یکی از کالاها یافت نشد یا فعال نیست.");
      case "INSUFFICIENT_STOCK":
        return errorResponse(409, "INSUFFICIENT_STOCK", "موجودی برای این فروش کافی نیست.");
      case "IDEMPOTENCY_CONFLICT":
        return errorResponse(409, "IDEMPOTENCY_CONFLICT", "این شماره رسید قبلاً با اطلاعات دیگری ثبت شده است.");
      case "INVALID_REFERENCE":
        return errorResponse(400, "INVALID_REFERENCE", "تأمین‌کننده معتبر نیست.");
      case "NO_DEFAULT_WAREHOUSE":
        return errorResponse(503, "NO_DEFAULT_WAREHOUSE", "انبار پیش‌فرض تعریف نشده است.");
      case "SERIALIZATION_RETRY_EXHAUSTED":
        return errorResponse(503, "SERIALIZATION_RETRY_EXHAUSTED", "عملیات همزمان بود؛ لطفاً دوباره تلاش کنید.");
    }
  }
  console.error("[api/receipts] unexpected error:", error);
  return errorResponse(500, fallbackCode, fallbackMessage);
}

export async function POST(request: Request) {
  const authorization = await authorize(["MANAGER", "WAREHOUSE"]);
  if (!authorization.ok) {
    return errorResponse(
      authorization.status,
      authorization.status === 401 ? "UNAUTHENTICATED" : "FORBIDDEN",
      authorization.status === 401 ? "ورود به سیستم الزامی است." : "دسترسی لازم برای ثبت ورود کالا را ندارید.",
    );
  }

  const body = await readJson(request);
  if (!body.ok) return errorResponse(400, "INVALID_JSON", "بدنه درخواست معتبر نیست.");

  const parsed = receiptInputSchema.safeParse(body.data);
  if (!parsed.success) {
    return errorResponse(400, "VALIDATION_ERROR", "اطلاعات رسید معتبر نیست.", parsed.error.flatten());
  }

  const input = parsed.data;

  try {
    const receipt = await receiveGoods(input, authorization.user.id);
    return NextResponse.json(receipt, { status: receipt.created ? 201 : 200 });
  } catch (error) {
    return serviceErrorResponse(error, "RECEIPT_CREATE_FAILED", "ثبت رسید انجام نشد.");
  }
}
