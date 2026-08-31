-- CreateEnum
CREATE TYPE "McpClientType" AS ENUM ('codex', 'claude', 'other');

-- CreateEnum
CREATE TYPE "IdempotencyActorType" AS ENUM ('user', 'mcp_token');

-- CreateEnum
CREATE TYPE "McpAuditOutcome" AS ENUM ('success', 'rejected', 'failed');

-- CreateTable
CREATE TABLE "mcp_access_tokens" (
  "id" UUID NOT NULL,
  "project_id" UUID NOT NULL,
  "created_by_id" UUID NOT NULL,
  "label" VARCHAR(80) NOT NULL,
  "client_type" "McpClientType" NOT NULL,
  "token_prefix" VARCHAR(24) NOT NULL,
  "token_hash" VARCHAR(128) NOT NULL,
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "last_used_at" TIMESTAMPTZ(6),
  "revoked_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "mcp_access_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mutation_idempotency" (
  "id" UUID NOT NULL,
  "project_id" UUID NOT NULL,
  "actor_type" "IdempotencyActorType" NOT NULL,
  "actor_id" UUID NOT NULL,
  "operation" VARCHAR(80) NOT NULL,
  "idempotency_key" VARCHAR(128) NOT NULL,
  "request_fingerprint" VARCHAR(128) NOT NULL,
  "response_status" INTEGER NOT NULL,
  "response_body" JSONB NOT NULL,
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "mutation_idempotency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mcp_audit_events" (
  "id" UUID NOT NULL,
  "project_id" UUID NOT NULL,
  "token_id" UUID NOT NULL,
  "issue_id" UUID,
  "tool_name" VARCHAR(80) NOT NULL,
  "request_id" VARCHAR(128) NOT NULL,
  "idempotency_key" VARCHAR(128),
  "outcome" "McpAuditOutcome" NOT NULL,
  "changed_fields" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "error_code" VARCHAR(80),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "mcp_audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "mcp_access_tokens_token_prefix_key" ON "mcp_access_tokens"("token_prefix");
CREATE UNIQUE INDEX "mcp_access_tokens_token_hash_key" ON "mcp_access_tokens"("token_hash");
CREATE INDEX "mcp_access_tokens_project_id_revoked_at_expires_at_idx" ON "mcp_access_tokens"("project_id", "revoked_at", "expires_at");
CREATE INDEX "mcp_access_tokens_created_by_id_idx" ON "mcp_access_tokens"("created_by_id");
CREATE UNIQUE INDEX "mutation_idempotency_project_id_actor_type_actor_id_op_key" ON "mutation_idempotency"("project_id", "actor_type", "actor_id", "operation", "idempotency_key");
CREATE INDEX "mutation_idempotency_expires_at_idx" ON "mutation_idempotency"("expires_at");
CREATE INDEX "mcp_audit_events_project_id_created_at_idx" ON "mcp_audit_events"("project_id", "created_at");
CREATE INDEX "mcp_audit_events_token_id_created_at_idx" ON "mcp_audit_events"("token_id", "created_at");
CREATE INDEX "mcp_audit_events_issue_id_idx" ON "mcp_audit_events"("issue_id");

-- AddForeignKey
ALTER TABLE "mcp_access_tokens" ADD CONSTRAINT "mcp_access_tokens_project_id_fkey"
FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "mcp_access_tokens" ADD CONSTRAINT "mcp_access_tokens_created_by_id_fkey"
FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "mutation_idempotency" ADD CONSTRAINT "mutation_idempotency_project_id_fkey"
FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mcp_audit_events" ADD CONSTRAINT "mcp_audit_events_project_id_fkey"
FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "mcp_audit_events" ADD CONSTRAINT "mcp_audit_events_token_id_fkey"
FOREIGN KEY ("token_id") REFERENCES "mcp_access_tokens"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "mcp_audit_events" ADD CONSTRAINT "mcp_audit_events_issue_id_fkey"
FOREIGN KEY ("issue_id") REFERENCES "issues"("id") ON DELETE SET NULL ON UPDATE CASCADE;
