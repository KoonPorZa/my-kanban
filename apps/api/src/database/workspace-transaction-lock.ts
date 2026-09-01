import type { Prisma } from '@prisma/client';

export async function lockOwnerWorkspaceTransaction(
  transaction: Prisma.TransactionClient,
  ownerId: string
) {
  const rows = await transaction.$queryRaw<Array<{ id: string }>>`
    SELECT id::text
    FROM workspaces
    WHERE owner_id = ${ownerId}::uuid
    ORDER BY created_at ASC
    LIMIT 1
    FOR UPDATE
  `;
  return rows[0]?.id ?? null;
}

export async function lockWorkspaceTransaction(
  transaction: Prisma.TransactionClient,
  workspaceId: string
) {
  const rows = await transaction.$queryRaw<Array<{ id: string }>>`
    SELECT id::text
    FROM workspaces
    WHERE id = ${workspaceId}::uuid
    FOR UPDATE
  `;
  return rows[0]?.id ?? null;
}
