import { it, expect, describe } from 'vitest';

import { partitionBoardIssues } from './kanban-board-resilience';

const projectId = '11111111-1111-4111-8111-111111111111';
const columnId = '22222222-2222-4222-8222-222222222222';

describe('partitionBoardIssues', () => {
  it('keeps valid tasks while counting malformed records', () => {
    const valid = issue('33333333-3333-4333-8333-333333333333');
    const malformed = { ...issue('44444444-4444-4444-8444-444444444444'), labels: null };

    const result = partitionBoardIssues({
      issues: [valid, malformed, null],
      projectId,
      columnIds: new Set([columnId]),
    });

    expect(result.validIssues).toEqual([valid]);
    expect(result.skippedIssueCount).toBe(2);
  });

  it('skips cross-Project, missing-column, and duplicate task records independently', () => {
    const first = issue('33333333-3333-4333-8333-333333333333');

    const result = partitionBoardIssues({
      issues: [
        first,
        { ...first },
        { ...issue('44444444-4444-4444-8444-444444444444'), projectId: crypto.randomUUID() },
        { ...issue('55555555-5555-4555-8555-555555555555'), columnId: crypto.randomUUID() },
      ],
      projectId,
      columnIds: new Set([columnId]),
    });

    expect(result.validIssues).toEqual([first]);
    expect(result.skippedIssueCount).toBe(3);
  });
});

function issue(id: string) {
  return {
    id,
    projectId,
    sprintId: null,
    columnId,
    title: 'Valid task',
    description: '',
    type: 'task',
    priority: 'medium',
    labels: [],
    storyPoints: null,
    dueDate: null,
    isBlocked: false,
    blockedReason: null,
    checklist: [],
    checklistIncompleteCount: 0,
    completedAt: null,
    version: 1,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  };
}
