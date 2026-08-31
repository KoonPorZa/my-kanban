import type { IKanbanTask } from 'src/types/kanban';
import type { BoardResponseDto } from '@my-kanban/api-client';

import { it, vi, expect, describe, afterEach } from 'vitest';
import { getGetBoardQueryKey, getListSprintsQueryKey } from '@my-kanban/api-client';

import { getQueryClient } from 'src/lib/query-client';

import { createTask, updateTask, clearColumn, previewTaskMove, moveTaskToBacklog } from './kanban';

const clearColumnApi = vi.hoisted(() => vi.fn());
const createIssueApi = vi.hoisted(() => vi.fn());
const updateIssueApi = vi.hoisted(() => vi.fn());
const createIssueInSprintApi = vi.hoisted(() => vi.fn());
const removeIssueFromSprintApi = vi.hoisted(() => vi.fn());

vi.mock('@my-kanban/api-client', async (importOriginal) => ({
  ...((await importOriginal()) as object),
  clearColumn: clearColumnApi,
  createIssue: createIssueApi,
  updateIssue: updateIssueApi,
  createIssueInSprint: createIssueInSprintApi,
  removeIssueFromSprint: removeIssueFromSprintApi,
}));

const projectId = '11111111-1111-4111-8111-111111111111';
const todoId = '22222222-2222-4222-8222-222222222222';
const doneId = '33333333-3333-4333-8333-333333333333';
const scopedBoardKey = getGetBoardQueryKey(projectId, { sprintId: 'sprint-1' });

describe('Sprint Board cache updates', () => {
  afterEach(() => {
    getQueryClient().clear();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('preserves hidden backlog issues when an Active Sprint task moves', () => {
    vi.stubGlobal('window', {});
    const queryClient = getQueryClient();
    const board: BoardResponseDto = {
      project: { id: projectId, name: 'Scrum', mode: 'scrum', version: 1 },
      columns: [
        { id: todoId, projectId, name: 'To do', category: 'todo', wipLimit: null, version: 1 },
        { id: doneId, projectId, name: 'Done', category: 'done', wipLimit: null, version: 1 },
      ],
      issues: [issue('active-task', todoId, 'sprint-1'), issue('backlog-task', todoId, null)],
    };
    queryClient.setQueryData(scopedBoardKey, board);
    queryClient.setQueryData(getListSprintsQueryKey(projectId), { sprints: [activeSprint()] });

    previewTaskMove(projectId, { [todoId]: [], [doneId]: [task('active-task', doneId)] });

    const updated = queryClient.getQueryData<BoardResponseDto>(scopedBoardKey);
    expect(updated?.issues).toHaveLength(2);
    expect(updated?.issues.find((item) => item.id === 'active-task')?.columnId).toBe(doneId);
    expect(updated?.issues.find((item) => item.id === 'backlog-task')?.columnId).toBe(todoId);
  });

  it('clears only visible Active Sprint tasks from the cache and API', async () => {
    vi.stubGlobal('window', {});
    const queryClient = getQueryClient();
    const column: BoardResponseDto['columns'][number] = {
      id: todoId,
      projectId,
      name: 'To do',
      category: 'todo',
      wipLimit: null,
      version: 1,
    };
    const board: BoardResponseDto = {
      project: { id: projectId, name: 'Scrum', mode: 'scrum', version: 1 },
      columns: [column],
      issues: [issue('active-task', todoId, 'sprint-1'), issue('backlog-task', todoId, null)],
    };
    queryClient.setQueryData(scopedBoardKey, board);
    queryClient.setQueryData(getListSprintsQueryKey(projectId), {
      sprints: [
        {
          id: 'sprint-1',
          projectId,
          name: 'Sprint 1',
          goal: '',
          status: 'active',
          startDate: '2026-09-01',
          endDate: '2026-09-14',
          plannedPoints: 0,
          plannedIssueCount: 1,
          completedPoints: 0,
          completedIssueCount: 0,
          incompletePoints: 0,
          incompleteIssueCount: 0,
          completedAt: null,
          version: 1,
          createdAt: '2026-09-01T00:00:00.000Z',
          updatedAt: '2026-09-01T00:00:00.000Z',
        },
      ],
    });
    clearColumnApi.mockResolvedValue({ ...column, version: 2 });

    await clearColumn(projectId, column);

    expect(clearColumnApi).toHaveBeenCalledWith(todoId, { version: 1, sprintId: 'sprint-1' });
    const updated = queryClient.getQueryData<BoardResponseDto>(scopedBoardKey);
    expect(updated?.issues.map(({ id }) => id)).toEqual(['backlog-task']);
  });

  it('creates an Active Sprint task atomically', async () => {
    vi.stubGlobal('window', {});
    const queryClient = getQueryClient();
    const column = {
      id: todoId,
      projectId,
      name: 'To do',
      category: 'todo' as const,
      wipLimit: null,
      version: 1,
    };
    queryClient.setQueryData(scopedBoardKey, {
      project: { id: projectId, name: 'Scrum', mode: 'scrum', version: 1 },
      columns: [column],
      issues: [],
    });
    queryClient.setQueryData(getListSprintsQueryKey(projectId), {
      sprints: [activeSprint()],
    });
    const created = issue('created-task', todoId, 'sprint-1');
    createIssueInSprintApi.mockResolvedValue(created);

    await createTask(projectId, todoId, task('temporary-task', todoId));

    expect(createIssueInSprintApi).toHaveBeenCalledWith(
      'sprint-1',
      expect.objectContaining({ columnId: todoId, title: 'temporary-task' })
    );
    expect(createIssueApi).not.toHaveBeenCalled();
    expect(
      queryClient
        .getQueryData<BoardResponseDto>(scopedBoardKey)
        ?.issues.some(({ id }) => id === created.id)
    ).toBe(true);
  });

  it('persists Story Points and keeps the optimistic cache in sync', async () => {
    vi.stubGlobal('window', {});
    const queryClient = getQueryClient();
    const existing = issue('estimated-task', todoId, 'sprint-1');
    queryClient.setQueryData(scopedBoardKey, {
      project: { id: projectId, name: 'Scrum', mode: 'scrum', version: 1 },
      columns: [],
      issues: [existing],
    });
    queryClient.setQueryData(getListSprintsQueryKey(projectId), { sprints: [activeSprint()] });
    updateIssueApi.mockResolvedValue({ ...existing, storyPoints: 8, version: 2 });

    await updateTask(projectId, { ...task(existing.id, todoId), storyPoints: 8 });

    expect(updateIssueApi).toHaveBeenCalledWith(
      existing.id,
      expect.objectContaining({ storyPoints: 8 })
    );
    expect(queryClient.getQueryData<BoardResponseDto>(scopedBoardKey)?.issues[0]?.storyPoints).toBe(
      8
    );
  });

  it('moves an Active Sprint task to backlog without archiving it', async () => {
    vi.stubGlobal('window', {});
    const queryClient = getQueryClient();
    const existing = issue('backlog-target', todoId, 'sprint-1');
    queryClient.setQueryData(scopedBoardKey, {
      project: { id: projectId, name: 'Scrum', mode: 'scrum', version: 1 },
      columns: [],
      issues: [existing],
    });
    queryClient.setQueryData(getListSprintsQueryKey(projectId), { sprints: [activeSprint()] });
    removeIssueFromSprintApi.mockResolvedValue(activeSprint());

    await moveTaskToBacklog(projectId, task(existing.id, todoId));

    expect(removeIssueFromSprintApi).toHaveBeenCalledWith('sprint-1', existing.id);
    expect(
      queryClient.getQueryData<BoardResponseDto>(scopedBoardKey)?.issues[0]?.sprintId
    ).toBeNull();
  });
});

function activeSprint() {
  return {
    id: 'sprint-1',
    projectId,
    name: 'Sprint 1',
    goal: '',
    status: 'active' as const,
    startDate: '2026-09-01',
    endDate: '2026-09-14',
    plannedPoints: 0,
    plannedIssueCount: 1,
    completedPoints: 0,
    completedIssueCount: 0,
    incompletePoints: 0,
    incompleteIssueCount: 0,
    completedAt: null,
    version: 1,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  };
}

function issue(id: string, columnId: string, sprintId: string | null) {
  return {
    id,
    projectId,
    sprintId,
    columnId,
    title: id,
    description: '',
    type: 'task' as const,
    priority: 'medium' as const,
    labels: [],
    storyPoints: null,
    dueDate: null,
    isBlocked: false,
    blockedReason: null,
    completedAt: null,
    version: 1,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  };
}

function task(id: string, columnId: string): IKanbanTask {
  return {
    id,
    version: 1,
    sprintId: 'sprint-1',
    storyPoints: null,
    name: id,
    status: columnId,
    priority: 'medium',
    labels: [],
    attachments: [],
    comments: [],
    assignee: [],
    due: ['2026-09-01T00:00:00.000Z', '2026-09-02T00:00:00.000Z'],
    reporter: { id: 'owner', name: 'Owner', avatarUrl: '' },
  };
}
