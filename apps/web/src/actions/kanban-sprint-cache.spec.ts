import type { IKanbanTask } from 'src/types/kanban';
import type { BoardResponseDto } from '@my-kanban/api-client';

import { it, vi, expect, describe, afterEach } from 'vitest';
import { getGetBoardQueryKey, getListSprintsQueryKey } from '@my-kanban/api-client';

import { getQueryClient } from 'src/lib/query-client';

import {
  createTask,
  updateTask,
  clearColumn,
  undoTaskMove,
  archiveColumn,
  previewTaskMove,
  persistTaskMove,
  moveTaskToBacklog,
} from './kanban';

const clearColumnApi = vi.hoisted(() => vi.fn());
const archiveColumnApi = vi.hoisted(() => vi.fn());
const createIssueApi = vi.hoisted(() => vi.fn());
const getBoardApi = vi.hoisted(() => vi.fn());
const updateIssueApi = vi.hoisted(() => vi.fn());
const moveIssueApi = vi.hoisted(() => vi.fn());
const createIssueInSprintApi = vi.hoisted(() => vi.fn());
const removeIssueFromSprintApi = vi.hoisted(() => vi.fn());

vi.mock('@my-kanban/api-client', async (importOriginal) => ({
  ...((await importOriginal()) as object),
  clearColumn: clearColumnApi,
  archiveColumn: archiveColumnApi,
  createIssue: createIssueApi,
  getBoard: getBoardApi,
  updateIssue: updateIssueApi,
  moveIssue: moveIssueApi,
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

  it('moves archived-column issues after existing destination issues and refetches server state', async () => {
    vi.stubGlobal('window', {});
    const sourceColumn = {
      id: todoId,
      projectId,
      name: 'To do',
      category: 'todo' as const,
      wipLimit: null,
      version: 1,
    };
    const destinationColumn = {
      id: doneId,
      projectId,
      name: 'Done',
      category: 'done' as const,
      wipLimit: null,
      version: 1,
    };
    const original: BoardResponseDto = {
      project: { id: projectId, name: 'Kanban', mode: 'kanban', version: 1 },
      columns: [sourceColumn, destinationColumn],
      issues: [
        issue('destination-task', doneId, null),
        issue('source-first', todoId, null),
        issue('source-second', todoId, null),
      ],
    };
    const refetched: BoardResponseDto = {
      ...original,
      columns: [destinationColumn],
      issues: [
        issue('destination-task', doneId, null),
        { ...issue('source-first', doneId, null), version: 2 },
        { ...issue('source-second', doneId, null), version: 2 },
      ],
    };
    getQueryClient().setQueryData(getGetBoardQueryKey(projectId), original);

    let resolveArchive!: (value: typeof sourceColumn) => void;
    archiveColumnApi.mockReturnValue(
      new Promise((resolve) => {
        resolveArchive = resolve;
      })
    );
    getBoardApi.mockResolvedValue(refetched);

    const operation = archiveColumn(projectId, sourceColumn, doneId, true);
    await vi.waitFor(() => {
      const optimistic = getQueryClient().getQueryData<BoardResponseDto>(
        getGetBoardQueryKey(projectId)
      );
      expect(optimistic?.columns.map(({ id }) => id)).toEqual([doneId]);
      expect(optimistic?.issues.map(({ id, columnId }) => [id, columnId])).toEqual([
        ['destination-task', doneId],
        ['source-first', doneId],
        ['source-second', doneId],
      ]);
    });

    resolveArchive({ ...sourceColumn, version: 2 });
    await operation;

    expect(archiveColumnApi).toHaveBeenCalledTimes(1);
    expect(archiveColumnApi).toHaveBeenCalledWith(todoId, {
      version: 1,
      destinationColumnId: doneId,
      allowIncompleteChecklist: true,
    });
    expect(getBoardApi).toHaveBeenCalledWith(projectId, undefined);
    expect(getQueryClient().getQueryData(getGetBoardQueryKey(projectId))).toEqual(refetched);
  });

  it('restores the exact Board cache when column archival fails', async () => {
    vi.stubGlobal('window', {});
    const sourceColumn = {
      id: todoId,
      projectId,
      name: 'To do',
      category: 'todo' as const,
      wipLimit: null,
      version: 1,
    };
    const original: BoardResponseDto = {
      project: { id: projectId, name: 'Kanban', mode: 'kanban', version: 1 },
      columns: [sourceColumn],
      issues: [issue('source-task', todoId, null)],
    };
    getQueryClient().setQueryData(getGetBoardQueryKey(projectId), original);
    archiveColumnApi.mockRejectedValue(new Error('archive failed'));

    await expect(archiveColumn(projectId, sourceColumn, doneId)).rejects.toThrow('archive failed');

    expect(archiveColumnApi).toHaveBeenCalledTimes(1);
    expect(getQueryClient().getQueryData(getGetBoardQueryKey(projectId))).toEqual(original);
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

  it('sends an explicit checklist override after Done confirmation', async () => {
    vi.stubGlobal('window', {});
    const existing = issue('guarded-task', todoId, 'sprint-1');
    getQueryClient().setQueryData(scopedBoardKey, {
      project: { id: projectId, name: 'Scrum', mode: 'scrum', version: 1 },
      columns: [],
      issues: [existing],
    });
    getQueryClient().setQueryData(getListSprintsQueryKey(projectId), { sprints: [activeSprint()] });
    moveIssueApi.mockResolvedValue({ ...existing, columnId: doneId, version: 2 });

    const movingTask = task(existing.id, todoId);
    await persistTaskMove(projectId, movingTask, doneId, [movingTask], true);

    expect(moveIssueApi).toHaveBeenCalledWith(
      existing.id,
      expect.objectContaining({
        targetColumnId: doneId,
        allowIncompleteChecklist: true,
      })
    );
  });

  it('projects a move immediately, calls the API once, and reconciles the returned version', async () => {
    vi.stubGlobal('window', {});
    const existing = issue('optimistic-task', todoId, 'sprint-1');
    getQueryClient().setQueryData(scopedBoardKey, {
      project: { id: projectId, name: 'Scrum', mode: 'scrum', version: 1 },
      columns: [],
      issues: [existing],
    });
    getQueryClient().setQueryData(getListSprintsQueryKey(projectId), { sprints: [activeSprint()] });

    let resolveMove!: (value: ReturnType<typeof issue>) => void;
    moveIssueApi.mockReturnValue(
      new Promise((resolve) => {
        resolveMove = resolve;
      })
    );

    const operation = persistTaskMove(projectId, task(existing.id, todoId), doneId, [
      task(existing.id, doneId),
    ]);
    await vi.waitFor(() => {
      expect(
        getQueryClient().getQueryData<BoardResponseDto>(scopedBoardKey)?.issues[0]?.columnId
      ).toBe(doneId);
    });
    expect(moveIssueApi).toHaveBeenCalledTimes(1);

    resolveMove({ ...existing, columnId: doneId, version: 2 });
    await operation;

    expect(moveIssueApi).toHaveBeenCalledTimes(1);
    expect(
      getQueryClient().getQueryData<BoardResponseDto>(scopedBoardKey)?.issues[0]
    ).toMatchObject({ columnId: doneId, version: 2 });
  });

  it('rolls the complete Board cache back when a move fails', async () => {
    vi.stubGlobal('window', {});
    const existing = issue('rollback-task', todoId, 'sprint-1');
    const original: BoardResponseDto = {
      project: { id: projectId, name: 'Scrum', mode: 'scrum', version: 1 },
      columns: [],
      issues: [existing],
    };
    getQueryClient().setQueryData(scopedBoardKey, original);
    getQueryClient().setQueryData(getListSprintsQueryKey(projectId), { sprints: [activeSprint()] });
    moveIssueApi.mockRejectedValue(new Error('move failed'));

    await expect(
      persistTaskMove(projectId, task(existing.id, todoId), doneId, [task(existing.id, doneId)])
    ).rejects.toThrow('move failed');

    expect(moveIssueApi).toHaveBeenCalledTimes(1);
    expect(getQueryClient().getQueryData<BoardResponseDto>(scopedBoardKey)).toEqual(original);
  });

  it('undoes a move with the version returned by the forward move and restores the original rank', async () => {
    vi.stubGlobal('window', {});
    const first = issue('first-task', todoId, 'sprint-1');
    const moving = issue('moving-task', todoId, 'sprint-1');
    const last = issue('last-task', todoId, 'sprint-1');
    getQueryClient().setQueryData(scopedBoardKey, {
      project: { id: projectId, name: 'Scrum', mode: 'scrum', version: 1 },
      columns: [],
      issues: [first, moving, last],
    });
    getQueryClient().setQueryData(getListSprintsQueryKey(projectId), { sprints: [activeSprint()] });
    moveIssueApi
      .mockResolvedValueOnce({ ...moving, columnId: doneId, version: 2 })
      .mockResolvedValueOnce({ ...moving, columnId: todoId, version: 3 });

    const movingTask = task(moving.id, todoId);
    const originalOrder = [task(first.id, todoId), movingTask, task(last.id, todoId)];
    const forward = await persistTaskMove(projectId, movingTask, doneId, [movingTask]);
    await undoTaskMove(projectId, movingTask, forward.version, todoId, originalOrder);

    expect(moveIssueApi).toHaveBeenNthCalledWith(
      1,
      moving.id,
      expect.objectContaining({ version: 1, targetColumnId: doneId })
    );
    expect(moveIssueApi).toHaveBeenNthCalledWith(2, moving.id, {
      version: 2,
      targetColumnId: todoId,
      sprintId: 'sprint-1',
      beforeIssueId: last.id,
      afterIssueId: first.id,
      allowIncompleteChecklist: false,
    });
    expect(
      getQueryClient()
        .getQueryData<BoardResponseDto>(scopedBoardKey)
        ?.issues.find(({ id }) => id === moving.id)
    ).toMatchObject({ columnId: todoId, version: 3 });
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
    checklist: [],
    checklistIncompleteCount: 0,
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
    type: 'task',
    dueDate: null,
    isBlocked: false,
    blockedReason: null,
    checklist: [],
    checklistIncompleteCount: 0,
    completedAt: null,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
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
