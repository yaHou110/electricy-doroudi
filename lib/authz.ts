import { auth } from "@/auth";

export type AppRole = "MANAGER" | "WAREHOUSE" | "SALES";

export async function authorize(roles: AppRole[]) {
  const session = await auth();

  if (!session?.user?.id) {
    return { ok: false as const, status: 401 as const };
  }

  if (!roles.includes(session.user.role as AppRole)) {
    return { ok: false as const, status: 403 as const };
  }

  return { ok: true as const, user: session.user };
}

export async function requireRole(roles: AppRole[]) {
  const result = await authorize(roles);
  return result.ok ? result.user : null;
}
