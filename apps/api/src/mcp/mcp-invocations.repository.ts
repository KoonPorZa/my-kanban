import type { McpTokenPrincipal } from '../mcp-tokens/mcp-token.types';

export type IdempotencyReservation =
  { replayed: true; response: unknown } | { replayed: false; reservationId: string };

export type McpAuditInput = {
  principal: McpTokenPrincipal;
  toolName: string;
  requestId: string;
  idempotencyKey?: string;
  issueId?: string | null;
  outcome: 'success' | 'rejected' | 'failed';
  changedFields: string[];
  errorCode?: string | null;
};

export abstract class McpInvocationsRepository {
  abstract reserve(
    principal: McpTokenPrincipal,
    operation: string,
    idempotencyKey: string,
    fingerprint: string
  ): Promise<IdempotencyReservation>;

  abstract complete(reservationId: string, response: unknown): Promise<void>;

  abstract release(reservationId: string): Promise<void>;

  abstract audit(input: McpAuditInput): Promise<void>;
}
