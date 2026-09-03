import { Prisma, PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export function isSerializationConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034";
}

export function isUniqueConstraint(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export function isForeignKeyConstraint(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003";
}

export async function lockProductRows(
  transaction: Prisma.TransactionClient,
  productIds: string[],
): Promise<void> {
  const ids = [...new Set(productIds)].sort();
  if (ids.length === 0) return;

  // IDs bind as text parameters; each must be cast to uuid or Postgres rejects `uuid = text`.
  const idParams = ids.map((id) => Prisma.sql`${id}::uuid`);
  await transaction.$queryRaw(
    Prisma.sql`SELECT "id" FROM "Product" WHERE "id" IN (${Prisma.join(idParams)}) FOR UPDATE`,
  );
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function runSerializableTransaction<T>(
  operation: (transaction: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await prisma.$transaction(operation, { isolationLevel: "Serializable" });
    } catch (error) {
      if (!isSerializationConflict(error) || attempt === maxAttempts) throw error;
      await wait(25 * 2 ** (attempt - 1));
    }
  }

  throw new Error("Serializable transaction retry loop exited unexpectedly.");
}
