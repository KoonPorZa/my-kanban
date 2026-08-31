import { createHash, randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { DomainError } from '../common/domain/domain-errors';
import type { McpTokenPrincipal } from '../mcp-tokens/mcp-token.types';
import { McpInvocationsRepository } from './mcp-invocations.repository';

export type McpMutationOptions<T> = {
  principal: McpTokenPrincipal;
  toolName: string;
  idempotencyKey: string;
  payload: unknown;
  changedFields: string[];
  issueId?: string | null;
  operation: () => Promise<T>;
};

@Injectable()
export class McpInvocationsService {
  constructor(private readonly invocations: McpInvocationsRepository) {}

  async execute<T>(options: McpMutationOptions<T>) {
    const requestId = randomUUID();
    let reservation;
    try {
      reservation = await this.invocations.reserve(
        options.principal,
        options.toolName,
        options.idempotencyKey,
        this.fingerprint(options.payload)
      );
    } catch (error) {
      await this.invocations.audit({
        principal: options.principal,
        toolName: options.toolName,
        requestId,
        idempotencyKey: options.idempotencyKey,
        issueId: options.issueId,
        outcome: error instanceof DomainError ? 'rejected' : 'failed',
        changedFields: options.changedFields,
        errorCode: error instanceof DomainError ? error.code : 'internal_error',
      });
      this.attachRequestId(error, requestId);
      throw error;
    }

    if (reservation.replayed) {
      await this.invocations.audit({
        principal: options.principal,
        toolName: options.toolName,
        requestId,
        idempotencyKey: options.idempotencyKey,
        issueId: options.issueId,
        outcome: 'success',
        changedFields: [],
      });
      return { result: reservation.response as T, replayed: true, requestId };
    }

    try {
      const result = await options.operation();
      await this.invocations.complete(reservation.reservationId, result);
      const resultIssueId = this.issueIdFromResult(result) ?? options.issueId;
      await this.invocations.audit({
        principal: options.principal,
        toolName: options.toolName,
        requestId,
        idempotencyKey: options.idempotencyKey,
        issueId: resultIssueId,
        outcome: 'success',
        changedFields: options.changedFields,
      });
      return { result, replayed: false, requestId };
    } catch (error) {
      await this.invocations.release(reservation.reservationId);
      await this.invocations.audit({
        principal: options.principal,
        toolName: options.toolName,
        requestId,
        idempotencyKey: options.idempotencyKey,
        issueId: options.issueId,
        outcome: error instanceof DomainError ? 'rejected' : 'failed',
        changedFields: options.changedFields,
        errorCode: error instanceof DomainError ? error.code : 'internal_error',
      });
      this.attachRequestId(error, requestId);
      throw error;
    }
  }

  private fingerprint(value: unknown) {
    return createHash('sha256').update(this.stableJson(value)).digest('hex');
  }

  private stableJson(value: unknown): string {
    if (Array.isArray(value)) return `[${value.map((item) => this.stableJson(item)).join(',')}]`;
    if (value && typeof value === 'object') {
      const record = value as Record<string, unknown>;
      return `{${Object.keys(record)
        .sort()
        .map((key) => `${JSON.stringify(key)}:${this.stableJson(record[key])}`)
        .join(',')}}`;
    }
    return JSON.stringify(value) ?? 'null';
  }

  private issueIdFromResult(result: unknown) {
    if (!result || typeof result !== 'object' || Array.isArray(result)) return null;
    const id = (result as { id?: unknown }).id;
    return typeof id === 'string' ? id : null;
  }

  private attachRequestId(error: unknown, requestId: string) {
    if (error && typeof error === 'object') {
      (error as { requestId?: string }).requestId = requestId;
    }
  }
}
