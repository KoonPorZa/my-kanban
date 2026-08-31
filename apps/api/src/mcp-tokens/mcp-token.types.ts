export type McpTokenPrincipal = {
  tokenId: string;
  tokenLabel: string;
  clientType: 'codex' | 'claude' | 'other';
  projectId: string;
  projectName: string;
  ownerId: string;
  expiresAt: Date;
  lastUsedAt: Date | null;
};
