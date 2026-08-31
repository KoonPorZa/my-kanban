import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../database/prisma.service';
import { DomainConflictError } from '../common/domain/domain-errors';
import type { McpTokenPrincipal } from '../mcp-tokens/mcp-token.types';
import {
  McpInvocationsRepository,
  type McpAuditInput,
  type IdempotencyReservation,
} from './mcp-invocations.repository';

const IDEMPOTENCY_LIFETIME_MS = 90 * 24 * 60 * 60 * 1000;

@Injectable()
export class PrismaMcpInvocationsRepository extends McpInvocationsRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async reserve(
    principal: McpTokenPrincipal,
    operation: string,
    idempotencyKey: string,
    fingerprint: string
  ): Promise<IdempotencyReservation> {
    const unique = {
      projectId_actorType_actorId_operation_idempotencyKey: {
        projectId: principal.projectId,
        actorType: 'mcp_token' as const,
        actorId: principal.tokenId,
        operation,
        idempotencyKey,
      },
    };
    const existing = await this.prisma.mutationIdempotency.findUnique({ where: unique });
    if (existing) return this.replay(existing.requestFingerprint, fingerprint, existing);

    try {
      const reserved = await this.prisma.mutationIdempotency.create({
        data: {
          projectId: principal.projectId,
          actorType: 'mcp_token',
          actorId: principal.tokenId,
          operation,
          idempotencyKey,
          requestFingerprint: fingerprint,
          responseStatus: 102,
          responseBody: { pending: true },
          expiresAt: new Date(Date.now() + IDEMPOTENCY_LIFETIME_MS),
        },
      });
      return { replayed: false, reservationId: reserved.id };
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
        throw error;
      }
      const raced = await this.prisma.mutationIdempotency.findUniqueOrThrow({ where: unique });
      return this.replay(raced.requestFingerprint, fingerprint, raced);
    }
  }

  async complete(reservationId: string, response: unknown) {
    await this.prisma.mutationIdempotency.update({
      where: { id: reservationId },
      data: {
        responseStatus: 200,
        responseBody: JSON.parse(JSON.stringify(response)) as Prisma.InputJsonValue,
      },
    });
  }

  async release(reservationId: string) {
    await this.prisma.mutationIdempotency.deleteMany({
      where: { id: reservationId, responseStatus: 102 },
    });
  }

  async audit(input: McpAuditInput) {
    await this.prisma.mcpAuditEvent.create({
      data: {
        projectId: input.principal.projectId,
        tokenId: input.principal.tokenId,
        issueId: input.issueId,
        toolName: input.toolName,
        requestId: input.requestId,
        idempotencyKey: input.idempotencyKey,
        outcome: input.outcome,
        changedFields: input.changedFields,
        errorCode: input.errorCode,
      },
    });
  }

  private replay(
    storedFingerprint: string,
    fingerprint: string,
    record: { responseStatus: number; responseBody: Prisma.JsonValue }
  ): IdempotencyReservation {
    if (storedFingerprint !== fingerprint) {
      throw new DomainConflictError('Idempotency key was already used with different input');
    }
    if (record.responseStatus === 102) {
      throw new DomainConflictError('An operation with this idempotency key is still in progress');
    }
    return { replayed: true, response: record.responseBody };
  }
}
