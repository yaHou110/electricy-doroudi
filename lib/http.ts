import { NextResponse } from "next/server";

export function errorResponse(
  status: number,
  code: string,
  error: string,
  details?: unknown,
) {
  const body: { code: string; error: string; details?: unknown } = { code, error };
  if (details !== undefined) body.details = details;
  return NextResponse.json(body, { status });
}

export async function readJson(request: Request): Promise<
  | { ok: true; data: unknown }
  | { ok: false }
> {
  try {
    return { ok: true, data: await request.json() };
  } catch {
    return { ok: false };
  }
}
