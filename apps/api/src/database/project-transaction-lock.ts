import type { Prisma } from '@prisma/client';

export async function lockProjectTransaction(
  transaction: Prisma.TransactionClient,
  projectId: string
) {
  await transaction.$queryRaw`
    SELECT pg_advisory_xact_lock(hashtextextended(${projectId}, 0::bigint))::text
  `;
}
