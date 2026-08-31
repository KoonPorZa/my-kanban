import type { CreateMcpTokenDto } from './dto/mcp-token.dto';
import type { McpTokenPrincipal } from './mcp-token.types';

export type StoredMcpToken = {
  id: string;
  projectId: string;
  projectName: string;
  label: string;
  clientType: 'codex' | 'claude' | 'other';
  tokenPrefix: string;
  tokenHash: string;
  expiresAt: Date;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
};

export abstract class McpTokensRepository {
  abstract create(
    ownerId: string,
    projectId: string,
    input: CreateMcpTokenDto & {
      tokenPrefix: string;
      tokenHash: string;
      expiresAt: Date;
      createdAt: Date;
    }
  ): Promise<StoredMcpToken>;

  abstract list(ownerId: string, projectId: string): Promise<StoredMcpToken[]>;

  abstract revoke(ownerId: string, projectId: string, tokenId: string): Promise<StoredMcpToken>;

  abstract findByPrefix(prefix: string): Promise<(StoredMcpToken & McpTokenPrincipal) | null>;

  abstract markUsed(tokenId: string, usedAt: Date): Promise<void>;

  abstract listAudit(
    ownerId: string,
    projectId: string
  ): Promise<
    Array<{
      id: string;
      projectId: string;
      tokenId: string;
      tokenLabel: string;
      issueId: string | null;
      toolName: string;
      requestId: string;
      outcome: 'success' | 'rejected' | 'failed';
      changedFields: string[];
      errorCode: string | null;
      createdAt: Date;
    }>
  >;
}
