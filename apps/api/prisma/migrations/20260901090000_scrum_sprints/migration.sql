CREATE TYPE "SprintStatus" AS ENUM ('planned', 'active', 'completed');

CREATE TABLE "sprints" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "goal" VARCHAR(500) NOT NULL DEFAULT '',
    "status" "SprintStatus" NOT NULL DEFAULT 'planned',
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "planned_points" INTEGER NOT NULL DEFAULT 0,
    "planned_issue_count" INTEGER NOT NULL DEFAULT 0,
    "completed_points" INTEGER NOT NULL DEFAULT 0,
    "completed_issue_count" INTEGER NOT NULL DEFAULT 0,
    "completed_at" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "sprints_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "sprints_date_range_check" CHECK ("end_date" >= "start_date"),
    CONSTRAINT "sprints_snapshot_check" CHECK (
        "planned_points" >= 0 AND
        "planned_issue_count" >= 0 AND
        "completed_points" >= 0 AND
        "completed_issue_count" >= 0
    ),
    CONSTRAINT "sprints_completed_at_check" CHECK (
        ("status" = 'completed' AND "completed_at" IS NOT NULL) OR
        ("status" <> 'completed' AND "completed_at" IS NULL)
    )
);

ALTER TABLE "issues" ADD COLUMN "sprint_id" UUID;

CREATE INDEX "sprints_project_id_status_start_date_idx"
    ON "sprints"("project_id", "status", "start_date" DESC);

CREATE UNIQUE INDEX "sprints_one_active_per_project_idx"
    ON "sprints"("project_id") WHERE "status" = 'active';

CREATE INDEX "issues_project_id_sprint_id_archived_at_column_id_rank_idx"
    ON "issues"("project_id", "sprint_id", "archived_at", "column_id", "rank");

ALTER TABLE "sprints"
    ADD CONSTRAINT "sprints_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "issues"
    ADD CONSTRAINT "issues_sprint_id_fkey"
    FOREIGN KEY ("sprint_id") REFERENCES "sprints"("id") ON DELETE SET NULL ON UPDATE CASCADE;
