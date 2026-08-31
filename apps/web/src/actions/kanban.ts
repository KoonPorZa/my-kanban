'use client';

import type { UniqueIdentifier } from '@dnd-kit/core';
import type { IKanban, IKanbanTask, IKanbanColumn } from 'src/types/kanban';
import type {
  BoardResponseDto,
  IssueResponseDto,
  BoardColumnResponseDto,
} from '@my-kanban/api-client';

import {
  getBoard,
  moveIssue,
  createIssue,
  updateIssue,
  archiveIssue,
  useListProjects,
  getGetBoardQueryKey,
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

function toKanban(board: BoardResponseDto): IKanban {
  const tasks: IKanban['tasks'] = {};

  for (const column of board.columns) {
    tasks[column.id] = board.issues
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
  return getGetBoardQueryKey(projectId);
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
  const boardQuery = useGetBoardApi(projectId, {
    query: {
      enabled: Boolean(projectId),
      select: toKanban,
      refetchInterval: 15_000,
      refetchOnWindowFocus: true,
    },
  });
  const board = boardQuery.data ?? emptyBoard;

  return {
    board,
    boardLoading: projectsQuery.isLoading || boardQuery.isLoading,
    boardError: projectsQuery.error ?? boardQuery.error,
    boardValidating: projectsQuery.isFetching || boardQuery.isFetching,
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
  return optimisticMutation(
    projectId,
    (board) => ({
      ...board,
      issues: board.issues.filter((issue) => issue.columnId !== column.id),
    }),
    () => clearColumnApi(String(column.id), { version: column.version }),
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
  const timestamp = new Date().toISOString();
  const optimisticIssue: IssueResponseDto = {
    id: String(taskData.id),
    projectId,
    columnId: String(columnId),
    title: taskData.name,
    description: taskData.description ?? '',
    type: 'task',
    priority: taskData.priority as IssueResponseDto['priority'],
    labels: taskData.labels,
    storyPoints: null,
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
    () =>
      createIssue(projectId, {
        columnId: String(columnId),
        title: taskData.name,
        description: taskData.description ?? '',
        priority: taskData.priority as IssueResponseDto['priority'],
        labels: taskData.labels,
        dueDate: taskData.due[1] ? new Date(String(taskData.due[1])).toISOString() : undefined,
      }),
    (board, created) => ({
      ...board,
      issues: board.issues.map((issue) => (issue.id === optimisticIssue.id ? created : issue)),
    })
  );
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
      }),
    (board, updated) => ({
      ...board,
      issues: board.issues.map((issue) => (issue.id === updated.id ? updated : issue)),
    })
  );
}

export function previewTaskMove(projectId: string, tasks: IKanban['tasks']) {
  updateBoardCache(projectId, (board) => ({
    ...board,
    issues: board.columns.flatMap((column) =>
      (tasks[column.id] ?? []).flatMap((task) => {
        const issue = board.issues.find((item) => item.id === task.id);
        return issue ? [{ ...issue, columnId: column.id }] : [];
      })
    ),
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
  const board = await getBoard(projectId);
  getQueryClient().setQueryData(boardKey(projectId), board);
}
