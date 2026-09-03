import { auth } from "@/auth";

export type AppRole = "MANAGER" | "WAREHOUSE" | "SALES";

export async function requireRole(roles: AppRole[]) {
  const session = await auth();
  if (!session?.user?.id || !roles.includes(session.user.role as AppRole)) {
    return null;
  }
  return session.user;
}
