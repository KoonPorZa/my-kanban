-- CreateEnum
CREATE TYPE "ProjectMode" AS ENUM ('kanban', 'scrum');

-- CreateEnum
CREATE TYPE "IssuePriority" AS ENUM ('urgent', 'high', 'medium', 'low', 'none');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "display_name" VARCHAR(120) NOT NULL,
    "avatar_url" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_identities" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "provider" VARCHAR(32) NOT NULL,
    "provider_subject" VARCHAR(255) NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "email_verified" BOOLEAN NOT NULL,
    "last_login_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "auth_identities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "http_sessions" (
    "sid" VARCHAR(255) NOT NULL,
    "sess" JSONB NOT NULL,
    "expire" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "http_sessions_pkey" PRIMARY KEY ("sid")
);

-- CreateTable
CREATE TABLE "workspaces" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "active_project_id" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "color" VARCHAR(32) NOT NULL DEFAULT 'primary',
    "mode" "ProjectMode" NOT NULL DEFAULT 'kanban',
    "version" INTEGER NOT NULL DEFAULT 1,
    "archived_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "board_columns" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "rank" BIGINT NOT NULL,
    "wip_limit" INTEGER,
    "archived_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "board_columns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "issues" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "column_id" UUID NOT NULL,
    "title" VARCHAR(240) NOT NULL,
    "description" TEXT,
    "priority" "IssuePriority" NOT NULL DEFAULT 'medium',
    "labels" TEXT[],
    "rank" BIGINT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "due_date" TIMESTAMPTZ(6),
    "is_blocked" BOOLEAN NOT NULL DEFAULT false,
    "blocked_reason" TEXT,
    "archived_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "issues_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "auth_identities_email_key" ON "auth_identities"("email");

-- CreateIndex
CREATE INDEX "auth_identities_user_id_idx" ON "auth_identities"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "auth_identities_provider_provider_subject_key" ON "auth_identities"("provider", "provider_subject");

-- CreateIndex
CREATE INDEX "http_sessions_expire_idx" ON "http_sessions"("expire");

-- CreateIndex
CREATE INDEX "workspaces_owner_id_idx" ON "workspaces"("owner_id");

-- CreateIndex
CREATE INDEX "projects_workspace_id_archived_at_idx" ON "projects"("workspace_id", "archived_at");

-- CreateIndex
CREATE INDEX "board_columns_project_id_archived_at_rank_idx" ON "board_columns"("project_id", "archived_at", "rank");

-- CreateIndex
CREATE UNIQUE INDEX "board_columns_project_id_rank_key" ON "board_columns"("project_id", "rank");

-- CreateIndex
CREATE INDEX "issues_project_id_archived_at_column_id_rank_idx" ON "issues"("project_id", "archived_at", "column_id", "rank");

-- CreateIndex
CREATE INDEX "issues_project_id_due_date_idx" ON "issues"("project_id", "due_date");

-- CreateIndex
CREATE UNIQUE INDEX "issues_column_id_rank_key" ON "issues"("column_id", "rank");

-- AddForeignKey
ALTER TABLE "auth_identities" ADD CONSTRAINT "auth_identities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "board_columns" ADD CONSTRAINT "board_columns_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issues" ADD CONSTRAINT "issues_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issues" ADD CONSTRAINT "issues_column_id_fkey" FOREIGN KEY ("column_id") REFERENCES "board_columns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
