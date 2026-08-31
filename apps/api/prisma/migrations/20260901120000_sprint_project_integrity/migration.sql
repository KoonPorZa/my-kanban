ALTER TABLE "issues"
    DROP CONSTRAINT "issues_sprint_id_fkey";

ALTER TABLE "sprints"
    ADD CONSTRAINT "sprints_id_project_id_key" UNIQUE ("id", "project_id");

ALTER TABLE "issues"
    ADD CONSTRAINT "issues_sprint_id_project_id_fkey"
    FOREIGN KEY ("sprint_id", "project_id")
    REFERENCES "sprints"("id", "project_id")
    ON DELETE RESTRICT
    ON UPDATE CASCADE;
