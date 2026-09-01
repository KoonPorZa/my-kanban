import type { BoardResponseDto, IssueResponseDto } from '@my-kanban/api-client';

import { getGetBoardQueryKey } from '@my-kanban/api-client';
import { vi, it, expect, describe, afterEach } from 'vitest';

import { getQueryClient } from 'src/lib/query-client';

import { createBacklogIssue, reorderBacklogIssue } from './sprint-backlog';

const moveIssueApi = vi.hoisted(() => vi.fn());
const createIssueApi = vi.hoisted(() => vi.fn());

vi.mock('@my-kanban/api-client', async (importOriginal) => ({
  ...((await importOriginal()) as object),
  moveIssue: moveIssueApi,
  createIssue: createIssueApi,
}));

const projectId = '11111111-1111-4111-8111-111111111111';
const columnId = '22222222-2222-4222-8222-222222222222';

describe('Sprint backlog ordering', () => {
  afterEach(() => {
    getQueryClient().clear();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('optimistically reorders one column and persists exactly one move', async () => {
    vi.stubGlobal('window', {});
    const first = issue('first');
    const second = issue('second');
    const third = issue('third');
    seed([first, second, third]);
    moveIssueApi.mockResolvedValue({ ...third, version: 2 });

    await reorderBacklogIssue(projectId, third, [third, first, second]);

    expect(moveIssueApi).toHaveBeenCalledTimes(1);
    expect(moveIssueApi).toHaveBeenCalledWith(third.id, {
      version: 1,
      targetColumnId: columnId,
      beforeIssueId: first.id,
      afterIssueId: undefined,
    });
    expect(cachedIds()).toEqual(['third', 'first', 'second']);
  });

  it('rolls the optimistic order back when persistence fails', async () => {
    vi.stubGlobal('window', {});
    const first = issue('first');
    const second = issue('second');
    seed([first, second]);
    moveIssueApi.mockRejectedValue(new Error('move failed'));

    await expect(reorderBacklogIssue(projectId, second, [second, first])).rejects.toThrow(
      'move failed'
    );

    expect(moveIssueApi).toHaveBeenCalledTimes(1);
    expect(cachedIds()).toEqual(['first', 'second']);
  });

  it('rejects a fake cross-column order before issuing a request', async () => {
    vi.stubGlobal('window', {});
    const first = issue('first');
    const otherColumn = { ...issue('other'), columnId: '33333333-3333-4333-8333-333333333333' };
    seed([first, otherColumn]);

    await expect(reorderBacklogIssue(projectId, first, [first, otherColumn])).rejects.toThrow(
      'within their Board column'
    );
    expect(moveIssueApi).not.toHaveBeenCalled();
  });

  it('quick-creates a title-only backlog task in the first workflow column', async () => {
    createIssueApi.mockResolvedValue(issue('created'));

    await createBacklogIssue(projectId, columnId, '  Reachable backlog task  ');

    expect(createIssueApi).toHaveBeenCalledTimes(1);
    expect(createIssueApi).toHaveBeenCalledWith(projectId, {
      columnId,
      title: 'Reachable backlog task',
    });
  });
});

function issue(id: string): IssueResponseDto {
  return {
    id,
    projectId,
    sprintId: null,
    columnId,
    title: id,
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

function seed(issues: IssueResponseDto[]) {
  const board: BoardResponseDto = {
    project: { id: projectId, name: 'Sprint', mode: 'scrum', version: 1 },
    columns: [
      { id: columnId, projectId, name: 'To do', category: 'todo', wipLimit: null, version: 1 },
    ],
    issues,
  };
  getQueryClient().setQueryData(getGetBoardQueryKey(projectId), board);
}

function cachedIds() {
  return (
    getQueryClient()
      .getQueryData<BoardResponseDto>(getGetBoardQueryKey(projectId))
      ?.issues.map(({ id }) => id) ?? []
  );
}
