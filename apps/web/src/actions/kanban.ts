'use client';

import type { UniqueIdentifier } from '@dnd-kit/core';
import type { IKanban, IKanbanTask, IKanbanColumn } from 'src/types/kanban';
import type {
  BoardResponseDto,
  IssueResponseDto,
  SprintListResponseDto,
  BoardColumnResponseDto,
} from '@my-kanban/api-client';

import {
  getBoard,
  moveIssue,
  createIssue,
  updateIssue,
  archiveIssue,
  useListSprints,
  useListProjects,
  createIssueInSprint,
  getGetBoardQueryKey,
  removeIssueFromSprint,
  getListSprintsQueryKey,
  moveColumn as moveColumnApi,
  clearColumn as clearColumnApi,
  useGetBoard as useGetBoardApi,
  createColumn as createColumnApi,
  updateColumn as updateColumnApi,
  archiveColumn as archiveColumnApi,
} from '@my-kanban/api-client';

import { getQueryClient } from 'src/lib/query-client';

const emptyBoard: IKanban = {
  projectId: '',
  projectName: '',
  columns: [],
  tasks: {},
};

function toKanbanTask(issue: IssueResponseDto, status: string): IKanbanTask {
  return {
    id: issue.id,
    version: issue.version,
    sprintId: issue.sprintId,
    storyPoints: issue.storyPoints,
    name: issue.title,
    status,
    priority: issue.priority,
    description: issue.description,
    attachments: [],
    labels: issue.labels,
    comments: [],
    assignee: [],
    due: [issue.createdAt, issue.dueDate ?? issue.createdAt],
    reporter: { id: 'owner', name: 'Owner', avatarUrl: '' },
  };
}

function toKanban(board: BoardResponseDto, sprintId?: string | null): IKanban {
  const tasks: IKanban['tasks'] = {};
  const visibleIssues =
    sprintId === undefined
      ? board.issues
      : sprintId === null
        ? []
        : board.issues.filter((issue) => issue.sprintId === sprintId);

  for (const column of board.columns) {
    tasks[column.id] = visibleIssues
      .filter((issue) => issue.columnId === column.id)
      .map((issue) => toKanbanTask(issue, column.name));
  }

  return {
    projectId: board.project.id,
    projectName: board.project.name,
    columns: board.columns,
    tasks,
  };
}

function boardKey(projectId: string) {
  const sprintId = activeSprintIdForProject(projectId);
  return getGetBoardQueryKey(projectId, sprintId ? { sprintId } : undefined);
}

function updateBoardCache(
  projectId: string,
  updater: (board: BoardResponseDto) => BoardResponseDto
) {
  getQueryClient().setQueryData<BoardResponseDto>(boardKey(projectId), (board) =>
    board ? updater(board) : board
  );
}

async function optimisticMutation<T>(
  projectId: string,
  updater: (board: BoardResponseDto) => BoardResponseDto,
  operation: () => Promise<T>,
  reconcile?: (board: BoardResponseDto, result: T) => BoardResponseDto
) {
  const queryClient = getQueryClient();
  const queryKey = boardKey(projectId);
  await queryClient.cancelQueries({ queryKey });
  const previous = queryClient.getQueryData<BoardResponseDto>(queryKey);
  updateBoardCache(projectId, updater);

  try {
    const result = await operation();
    if (reconcile) updateBoardCache(projectId, (board) => reconcile(board, result));
    return result;
  } catch (error) {
    if (previous) queryClient.setQueryData(queryKey, previous);
    throw error;
  } finally {
    await queryClient.invalidateQueries({ queryKey });
  }
}

export function useGetBoard() {
  const projectsQuery = useListProjects({
    query: { staleTime: 30_000, refetchOnWindowFocus: true },
  });
  const projectId = projectsQuery.data?.activeProjectId ?? '';
  const project = projectsQuery.data?.projects.find((item) => item.id === projectId);
  const isScrum = project?.mode === 'scrum';
  const sprintsQuery = useListSprints(projectId, {
    query: {
      enabled: Boolean(projectId) && isScrum,
      refetchInterval: 15_000,
      refetchOnWindowFocus: true,
    },
  });
  const activeSprint = sprintsQuery.data?.sprints.find((sprint) => sprint.status === 'active');
  const boardQuery = useGetBoardApi(
    projectId,
    activeSprint ? { sprintId: activeSprint.id } : undefined,
    {
      query: {
        enabled: Boolean(projectId) && (!isScrum || Boolean(activeSprint)),
        select: (board) => toKanban(board, isScrum ? (activeSprint?.id ?? null) : undefined),
        refetchInterval: 15_000,
        refetchOnWindowFocus: true,
      },
    }
  );
  const board = boardQuery.data ?? emptyBoard;

  return {
    board,
    projectMode: project?.mode ?? 'kanban',
    activeSprint: activeSprint ?? null,
    boardLoading:
      projectsQuery.isLoading || boardQuery.isLoading || (isScrum && sprintsQuery.isLoading),
    boardError: projectsQuery.error ?? boardQuery.error ?? sprintsQuery.error,
    boardValidating:
      projectsQuery.isFetching || boardQuery.isFetching || (isScrum && sprintsQuery.isFetching),
    boardEmpty:
      !projectsQuery.isLoading &&
      !boardQuery.isLoading &&
      Boolean(projectId) &&
      !board.columns.length,
  };
}

export async function createColumn(projectId: string, columnData: IKanbanColumn) {
  const optimisticColumn: BoardColumnResponseDto = {
    id: String(columnData.id),
    projectId,
    name: columnData.name,
    category: columnData.category,
    wipLimit: columnData.wipLimit,
    version: 1,
  };

  return optimisticMutation(
    projectId,
    (board) => ({ ...board, columns: [...board.columns, optimisticColumn] }),
    () => createColumnApi(projectId, { name: columnData.name }),
    (board, created) => ({
      ...board,
      columns: board.columns.map((column) =>
        column.id === optimisticColumn.id ? created : column
      ),
    })
  );
}

export async function updateColumn(projectId: string, column: IKanbanColumn, name: string) {
  return optimisticMutation(
    projectId,
    (board) => ({
      ...board,
      columns: board.columns.map((item) => (item.id === column.id ? { ...item, name } : item)),
    }),
    () => updateColumnApi(String(column.id), { version: column.version, name }),
    (board, updated) => ({
      ...board,
      columns: board.columns.map((item) => (item.id === updated.id ? updated : item)),
    })
  );
}

export async function moveColumn(
  projectId: string,
  column: IKanbanColumn,
  columns: IKanbanColumn[]
) {
  const index = columns.findIndex((item) => item.id === column.id);
  const beforeColumnId = columns[index + 1]?.id;
  const afterColumnId = columns[index - 1]?.id;

  return optimisticMutation(
    projectId,
    (board) => ({
      ...board,
      columns: columns.map((item) => {
        const source = board.columns.find((columnItem) => columnItem.id === item.id);
        return source ?? { ...item, id: String(item.id) };
      }),
    }),
    () =>
      moveColumnApi(String(column.id), {
        version: column.version,
        beforeColumnId: beforeColumnId ? String(beforeColumnId) : undefined,
        afterColumnId: afterColumnId ? String(afterColumnId) : undefined,
      }),
    (board, updated) => ({
      ...board,
      columns: board.columns.map((item) => (item.id === updated.id ? updated : item)),
    })
  );
}

export async function clearColumn(projectId: string, column: IKanbanColumn) {
  const sprintId = activeSprintIdForProject(projectId) ?? undefined;
  return optimisticMutation(
    projectId,
    (board) => ({
      ...board,
      issues: board.issues.filter(
        (issue) => issue.columnId !== column.id || (sprintId && issue.sprintId !== sprintId)
      ),
    }),
    () => clearColumnApi(String(column.id), { version: column.version, sprintId }),
    (board, updated) => ({
      ...board,
      columns: board.columns.map((item) => (item.id === updated.id ? updated : item)),
    })
  );
}

export async function deleteColumn(projectId: string, column: IKanbanColumn) {
  return optimisticMutation(
    projectId,
    (board) => ({
      ...board,
      columns: board.columns.filter((item) => item.id !== column.id),
      issues: board.issues.filter((issue) => issue.columnId !== column.id),
    }),
    () => archiveColumnApi(String(column.id), { version: column.version })
  );
}

export async function createTask(
  projectId: string,
  columnId: UniqueIdentifier,
  taskData: IKanbanTask
) {
  const activeSprintId = activeSprintIdForProject(projectId);
  const timestamp = new Date().toISOString();
  const optimisticIssue: IssueResponseDto = {
    id: String(taskData.id),
    projectId,
    sprintId: activeSprintId,
    columnId: String(columnId),
    title: taskData.name,
    description: taskData.description ?? '',
    type: 'task',
    priority: taskData.priority as IssueResponseDto['priority'],
    labels: taskData.labels,
    storyPoints: taskData.storyPoints,
    dueDate: taskData.due[1] ? String(taskData.due[1]) : null,
    isBlocked: false,
    blockedReason: null,
    completedAt: null,
    version: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  return optimisticMutation(
    projectId,
    (board) => ({ ...board, issues: [optimisticIssue, ...board.issues] }),
    async () => {
      const input = {
        columnId: String(columnId),
        title: taskData.name,
        description: taskData.description ?? '',
        priority: taskData.priority as IssueResponseDto['priority'],
        labels: taskData.labels,
        storyPoints: taskData.storyPoints,
        dueDate: taskData.due[1] ? new Date(String(taskData.due[1])).toISOString() : undefined,
      };
      return activeSprintId
        ? createIssueInSprint(activeSprintId, input)
        : createIssue(projectId, input);
    },
    (board, created) => ({
      ...board,
      issues: board.issues.map((issue) => (issue.id === optimisticIssue.id ? created : issue)),
    })
  );
}

function activeSprintIdForProject(projectId: string) {
  const sprints = getQueryClient().getQueryData<SprintListResponseDto>(
    getListSprintsQueryKey(projectId)
  );
  return sprints?.sprints.find((sprint) => sprint.status === 'active')?.id ?? null;
}

export async function updateTask(projectId: string, taskData: IKanbanTask) {
  return optimisticMutation(
    projectId,
    (board) => ({
      ...board,
      issues: board.issues.map((issue) =>
        issue.id === taskData.id
          ? {
              ...issue,
              title: taskData.name,
              description: taskData.description ?? '',
              priority: taskData.priority as IssueResponseDto['priority'],
              labels: taskData.labels,
              storyPoints: taskData.storyPoints,
            }
          : issue
      ),
    }),
    () =>
      updateIssue(String(taskData.id), {
        version: taskData.version,
        title: taskData.name,
        description: taskData.description ?? '',
        priority: taskData.priority as IssueResponseDto['priority'],
        labels: taskData.labels,
        storyPoints: taskData.storyPoints,
      }),
    (board, updated) => ({
      ...board,
      issues: board.issues.map((issue) => (issue.id === updated.id ? updated : issue)),
    })
  );
}

export async function moveTaskToBacklog(projectId: string, task: IKanbanTask) {
  if (!task.sprintId) return;

  await optimisticMutation(
    projectId,
    (board) => ({
      ...board,
      issues: board.issues.map((issue) =>
        issue.id === task.id ? { ...issue, sprintId: null, version: issue.version + 1 } : issue
      ),
    }),
    () => removeIssueFromSprint(task.sprintId!, String(task.id))
  );
  await getQueryClient().invalidateQueries({ queryKey: getListSprintsQueryKey(projectId) });
}

export function previewTaskMove(projectId: string, tasks: IKanban['tasks']) {
  const columnByIssueId = new Map(
    Object.entries(tasks).flatMap(([columnId, columnTasks]) =>
      columnTasks.map((task) => [String(task.id), columnId] as const)
    )
  );
  updateBoardCache(projectId, (board) => ({
    ...board,
    issues: board.issues.map((issue) => {
      const columnId = columnByIssueId.get(issue.id);
      return columnId ? { ...issue, columnId } : issue;
    }),
  }));
}

export async function persistTaskMove(
  projectId: string,
  task: IKanbanTask,
  targetColumnId: UniqueIdentifier,
  orderedTasks: IKanbanTask[]
) {
  const index = orderedTasks.findIndex((item) => item.id === task.id);
  const beforeIssueId = orderedTasks[index + 1]?.id;
  const afterIssueId = orderedTasks[index - 1]?.id;
  const queryClient = getQueryClient();

  try {
    const updated = await moveIssue(String(task.id), {
      version: task.version,
      targetColumnId: String(targetColumnId),
      sprintId: task.sprintId ?? undefined,
      beforeIssueId: beforeIssueId ? String(beforeIssueId) : undefined,
      afterIssueId: afterIssueId ? String(afterIssueId) : undefined,
    });
    updateBoardCache(projectId, (board) => ({
      ...board,
      issues: board.issues.map((issue) => (issue.id === updated.id ? updated : issue)),
    }));
    return updated;
  } catch (error) {
    await queryClient.invalidateQueries({ queryKey: boardKey(projectId) });
    throw error;
  }
}

export async function archiveTask(projectId: string, task: IKanbanTask) {
  return optimisticMutation(
    projectId,
    (board) => ({
      ...board,
      issues: board.issues.filter((issue) => issue.id !== task.id),
    }),
    () => archiveIssue(String(task.id), { version: task.version })
  );
}

export async function refetchBoard(projectId: string) {
  const sprintId = activeSprintIdForProject(projectId);
  const board = await getBoard(projectId, sprintId ? { sprintId } : undefined);
  getQueryClient().setQueryData(boardKey(projectId), board);
}
