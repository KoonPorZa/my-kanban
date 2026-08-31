ALTER TABLE "projects" ADD COLUMN "done_retention_days" INTEGER NOT NULL DEFAULT 30;

CREATE TABLE "checklist_items" (
    "id" UUID NOT NULL,
    "issue_id" UUID NOT NULL,
    "title" VARCHAR(300) NOT NULL,
    "is_completed" BOOLEAN NOT NULL DEFAULT false,
    "rank" BIGINT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "checklist_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "checklist_items_issue_id_rank_key" ON "checklist_items"("issue_id", "rank");
CREATE INDEX "checklist_items_issue_id_rank_idx" ON "checklist_items"("issue_id", "rank");

ALTER TABLE "checklist_items"
ADD CONSTRAINT "checklist_items_issue_id_fkey"
FOREIGN KEY ("issue_id") REFERENCES "issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;
