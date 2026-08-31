-- CreateEnum
CREATE TYPE "BoardColumnCategory" AS ENUM ('todo', 'in_progress', 'done');

-- CreateEnum
CREATE TYPE "IssueType" AS ENUM ('task', 'story', 'bug', 'chore');

-- AlterTable
ALTER TABLE "board_columns"
ADD COLUMN "category" "BoardColumnCategory" NOT NULL DEFAULT 'todo',
ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

-- Preserve the semantic category of the default board columns.
UPDATE "board_columns"
SET "category" = CASE
  WHEN LOWER("name") = 'done' THEN 'done'::"BoardColumnCategory"
  WHEN LOWER("name") IN ('in progress', 'in-progress') THEN 'in_progress'::"BoardColumnCategory"
  ELSE 'todo'::"BoardColumnCategory"
END;

-- Normalize existing issue data before tightening the contract.
UPDATE "issues" SET "description" = '' WHERE "description" IS NULL;
UPDATE "issues" SET "title" = LEFT("title", 200) WHERE LENGTH("title") > 200;

-- AlterTable
ALTER TABLE "issues"
ALTER COLUMN "title" TYPE VARCHAR(200),
ALTER COLUMN "description" SET DEFAULT '',
ALTER COLUMN "description" SET NOT NULL,
ADD COLUMN "type" "IssueType" NOT NULL DEFAULT 'task',
ADD COLUMN "story_points" INTEGER;

-- AddConstraint
ALTER TABLE "issues"
ADD CONSTRAINT "issues_story_points_check"
CHECK ("story_points" IS NULL OR ("story_points" >= 0 AND "story_points" <= 100));

-- AddConstraint
ALTER TABLE "board_columns"
ADD CONSTRAINT "board_columns_wip_limit_check"
CHECK ("wip_limit" IS NULL OR "wip_limit" > 0);
