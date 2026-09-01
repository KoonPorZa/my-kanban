ALTER TABLE "sprints"
    ADD COLUMN "incomplete_points" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "incomplete_issue_count" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "sprints"
    DROP CONSTRAINT "sprints_snapshot_check",
    ADD CONSTRAINT "sprints_snapshot_check" CHECK (
        "planned_points" >= 0 AND
        "planned_issue_count" >= 0 AND
        "completed_points" >= 0 AND
        "completed_issue_count" >= 0 AND
        "incomplete_points" >= 0 AND
        "incomplete_issue_count" >= 0
    );
