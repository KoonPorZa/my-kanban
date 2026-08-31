import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { DomainUnauthorizedError, DomainValidationError } from '../common/domain/domain-errors';
import { McpTokensRepository, type StoredMcpToken } from './mcp-tokens.repository';
import type { CreateMcpTokenDto } from './dto/mcp-token.dto';

const TOKEN_LIFETIME_MS = 90 * 24 * 60 * 60 * 1000;
const LAST_USED_WRITE_INTERVAL_MS = 5 * 60 * 1000;
const TOKEN_PATTERN = /^mkp_([a-f0-9]{12})_([A-Za-z0-9_-]{43})$/;

@Injectable()
export class McpTokensService {
  constructor(private readonly tokens: McpTokensRepository) {}

  async create(ownerId: string, projectId: string, input: CreateMcpTokenDto) {
    const label = input.label.trim();
    if (!label) throw new DomainValidationError('Token label must not be empty');

    const createdAt = new Date();
    const prefix = randomBytes(6).toString('hex');
    const rawToken = `mkp_${prefix}_${randomBytes(32).toString('base64url')}`;
    const token = await this.tokens.create(ownerId, projectId, {
      ...input,
      label,
      tokenPrefix: prefix,
      tokenHash: this.hash(rawToken),
      expiresAt: new Date(createdAt.getTime() + TOKEN_LIFETIME_MS),
      createdAt,
    });
    return { ...this.toResponse(token), rawToken };
  }

  async list(ownerId: string, projectId: string) {
    return (await this.tokens.list(ownerId, projectId)).map((token) => this.toResponse(token));
  }

  async revoke(ownerId: string, projectId: string, tokenId: string) {
    return this.toResponse(await this.tokens.revoke(ownerId, projectId, tokenId));
  }

  async authenticate(authorization: string | undefined) {
    const rawToken = this.bearerToken(authorization);
    const match = TOKEN_PATTERN.exec(rawToken);
    if (!match) throw new DomainUnauthorizedError();

    const stored = await this.tokens.findByPrefix(match[1]);
    if (!stored || stored.revokedAt || stored.expiresAt <= new Date()) {
      throw new DomainUnauthorizedError();
    }

    const expected = Buffer.from(stored.tokenHash, 'hex');
    const actual = Buffer.from(this.hash(rawToken), 'hex');
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      throw new DomainUnauthorizedError();
    }

    if (
      !stored.lastUsedAt ||
      Date.now() - stored.lastUsedAt.getTime() >= LAST_USED_WRITE_INTERVAL_MS
    ) {
      const usedAt = new Date();
      await this.tokens.markUsed(stored.id, usedAt);
      stored.lastUsedAt = usedAt;
    }

    return {
      tokenId: stored.id,
      tokenLabel: stored.label,
      clientType: stored.clientType,
      projectId: stored.projectId,
      projectName: stored.projectName,
      ownerId: stored.ownerId,
      expiresAt: stored.expiresAt,
      lastUsedAt: stored.lastUsedAt,
    };
  }

  async listAudit(ownerId: string, projectId: string) {
    return (await this.tokens.listAudit(ownerId, projectId)).map((event) => ({
      ...event,
      createdAt: event.createdAt.toISOString(),
    }));
  }

  private bearerToken(authorization: string | undefined) {
    const [scheme, token, extra] = authorization?.trim().split(/\s+/) ?? [];
    if (scheme?.toLowerCase() !== 'bearer' || !token || extra) {
      throw new DomainUnauthorizedError();
    }
    return token;
  }

  private hash(rawToken: string) {
    return createHash('sha256').update(rawToken, 'utf8').digest('hex');
  }

  private toResponse(token: StoredMcpToken) {
    return {
      id: token.id,
      projectId: token.projectId,
      projectName: token.projectName,
      label: token.label,
      clientType: token.clientType,
      tokenPrefix: token.tokenPrefix,
      expiresAt: token.expiresAt.toISOString(),
      lastUsedAt: token.lastUsedAt?.toISOString() ?? null,
      revokedAt: token.revokedAt?.toISOString() ?? null,
      createdAt: token.createdAt.toISOString(),
    };
  }
}
