import type { IssueResponseDto } from '@my-kanban/api-client';

const ISSUE_TYPES = new Set(['task', 'story', 'bug', 'chore']);
const ISSUE_PRIORITIES = new Set(['urgent', 'high', 'medium', 'low', 'none']);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type PartitionBoardIssuesInput = {
  issues: readonly unknown[];
  projectId: string;
  columnIds: ReadonlySet<string>;
};

export type PartitionedBoardIssues = {
  validIssues: IssueResponseDto[];
  skippedIssueCount: number;
};

export function partitionBoardIssues({
  issues,
  projectId,
  columnIds,
}: PartitionBoardIssuesInput): PartitionedBoardIssues {
  const validIssues: IssueResponseDto[] = [];
  const seenIssueIds = new Set<string>();
  let skippedIssueCount = 0;

  for (const issue of issues) {
    if (!isValidIssueRecord(issue, projectId, columnIds) || seenIssueIds.has(issue.id)) {
      skippedIssueCount += 1;
      continue;
    }

    seenIssueIds.add(issue.id);
    validIssues.push(issue);
  }

  return { validIssues, skippedIssueCount };
}

function isValidIssueRecord(
  value: unknown,
  projectId: string,
  columnIds: ReadonlySet<string>
): value is IssueResponseDto {
  if (!isRecord(value)) return false;

  return (
    isUuid(value.id) &&
    value.projectId === projectId &&
    isNullableUuid(value.sprintId) &&
    typeof value.columnId === 'string' &&
    columnIds.has(value.columnId) &&
    isNonEmptyString(value.title) &&
    typeof value.description === 'string' &&
    typeof value.type === 'string' &&
    ISSUE_TYPES.has(value.type) &&
    typeof value.priority === 'string' &&
    ISSUE_PRIORITIES.has(value.priority) &&
    isStringArray(value.labels) &&
    isNullableStoryPoints(value.storyPoints) &&
    isNullableTimestamp(value.dueDate) &&
    typeof value.isBlocked === 'boolean' &&
    isNullableString(value.blockedReason) &&
    isChecklist(value.checklist) &&
    isNonNegativeInteger(value.checklistIncompleteCount) &&
    isNullableTimestamp(value.completedAt) &&
    isPositiveInteger(value.version) &&
    isTimestamp(value.createdAt) &&
    isTimestamp(value.updatedAt)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

function isNullableUuid(value: unknown): value is string | null {
  return value === null || isUuid(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && Boolean(value.trim());
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isNullableStoryPoints(value: unknown): value is number | null {
  return value === null || (isNonNegativeInteger(value) && value <= 100);
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) > 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0;
}

function isTimestamp(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && !Number.isNaN(Date.parse(value));
}

function isNullableTimestamp(value: unknown): value is string | null {
  return value === null || isTimestamp(value);
}

function isChecklist(value: unknown): value is IssueResponseDto['checklist'] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        isRecord(item) &&
        isUuid(item.id) &&
        isNonEmptyString(item.title) &&
        typeof item.isCompleted === 'boolean'
    )
  );
}
