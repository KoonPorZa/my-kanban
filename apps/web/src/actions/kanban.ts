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
  restoreIssue,
  duplicateIssue,
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

import { partitionBoardIssues } from './kanban-board-resilience';

const emptyBoard: IKanban = {
  projectId: '',
  projectName: '',
  columns: [],
  tasks: {},
  skippedIssueCount: 0,
};

function toKanbanTask(issue: IssueResponseDto, status: string): IKanbanTask {
  return {
    id: issue.id,
    version: issue.version,
    sprintId: issue.sprintId,
    storyPoints: issue.storyPoints,
    name: issue.title,
    status,
    type: issue.type,
    priority: issue.priority,
    dueDate: issue.dueDate,
    isBlocked: issue.isBlocked,
    blockedReason: issue.blockedReason,
    checklist: issue.checklist,
    checklistIncompleteCount: issue.checklistIncompleteCount,
    completedAt: issue.completedAt,
    createdAt: issue.createdAt,
    updatedAt: issue.updatedAt,
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
  const { validIssues, skippedIssueCount } = partitionBoardIssues({
    issues: board.issues,
    projectId: board.project.id,
    columnIds: new Set(board.columns.map((column) => column.id)),
  });
  const visibleIssues =
    sprintId === undefined
      ? validIssues
      : sprintId === null
        ? []
        : validIssues.filter((issue) => issue.sprintId === sprintId);

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
    skippedIssueCount,
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
      enabled: Boolean(projectId),
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
    doneRetentionDays: project?.doneRetentionDays ?? 30,
    activeSprint: activeSprint ?? null,
    sprintOptions: (sprintsQuery.data?.sprints ?? []).map(({ id, name }) => ({ id, name })),
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

export async function updateColumn(
  projectId: string,
  column: IKanbanColumn,
  changes: string | { name?: string; wipLimit?: number | null }
) {
  const data = typeof changes === 'string' ? { name: changes } : changes;
  return optimisticMutation(
    projectId,
    (board) => ({
      ...board,
      columns: board.columns.map((item) => (item.id === column.id ? { ...item, ...data } : item)),
    }),
    () => updateColumnApi(String(column.id), { version: column.version, ...data }),
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

export async function archiveColumn(
  projectId: string,
  column: IKanbanColumn,
  destinationColumnId?: string,
  allowIncompleteChecklist = false
) {
  const queryClient = getQueryClient();
  const queryKey = boardKey(projectId);
  await queryClient.cancelQueries({ queryKey });
  const previous = queryClient.getQueryData<BoardResponseDto>(queryKey);

  updateBoardCache(projectId, (board) => {
    const sourceIssues = board.issues
      .filter((issue) => issue.columnId === String(column.id))
      .map((issue) => (destinationColumnId ? { ...issue, columnId: destinationColumnId } : issue));
    const retainedIssues = board.issues.filter((issue) => issue.columnId !== String(column.id));
    const lastDestinationIndex = retainedIssues.findLastIndex(
      (issue) => issue.columnId === destinationColumnId
    );
    const insertAt = lastDestinationIndex >= 0 ? lastDestinationIndex + 1 : retainedIssues.length;

    return {
      ...board,
      columns: board.columns.filter((item) => item.id !== column.id),
      issues: destinationColumnId
        ? [...retainedIssues.slice(0, insertAt), ...sourceIssues, ...retainedIssues.slice(insertAt)]
        : retainedIssues,
    };
  });

  let archived: BoardColumnResponseDto;
  try {
    const input = {
      version: column.version,
      destinationColumnId,
      allowIncompleteChecklist,
    };
    archived = await archiveColumnApi(String(column.id), input);
  } catch (error) {
    if (previous) queryClient.setQueryData(queryKey, previous);
    await queryClient.invalidateQueries({ queryKey });
    throw error;
  }

  try {
    await refetchBoard(projectId);
  } catch {
    await queryClient.invalidateQueries({ queryKey });
  }
  return archived;
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
    type: taskData.type,
    priority: taskData.priority as IssueResponseDto['priority'],
    labels: taskData.labels,
    storyPoints: taskData.storyPoints,
    dueDate: taskData.dueDate,
    isBlocked: taskData.isBlocked,
    blockedReason: taskData.blockedReason,
    checklist: taskData.checklist ?? [],
    checklistIncompleteCount: taskData.checklistIncompleteCount ?? 0,
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
        type: taskData.type,
        priority: taskData.priority as IssueResponseDto['priority'],
        labels: taskData.labels,
        storyPoints: taskData.storyPoints,
        dueDate: taskData.dueDate,
        isBlocked: taskData.isBlocked,
        blockedReason: taskData.blockedReason,
        checklist: taskData.checklist ?? [],
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
              type: taskData.type,
              priority: taskData.priority as IssueResponseDto['priority'],
              labels: taskData.labels,
              storyPoints: taskData.storyPoints,
              dueDate: taskData.dueDate,
              isBlocked: taskData.isBlocked,
              blockedReason: taskData.blockedReason,
              checklist: taskData.checklist ?? [],
              checklistIncompleteCount: (taskData.checklist ?? []).filter(
                (item) => !item.isCompleted
              ).length,
            }
          : issue
      ),
    }),
    () =>
      updateIssue(String(taskData.id), {
        version: taskData.version,
        title: taskData.name,
        description: taskData.description ?? '',
        type: taskData.type,
        priority: taskData.priority as IssueResponseDto['priority'],
        labels: taskData.labels,
        storyPoints: taskData.storyPoints,
        dueDate: taskData.dueDate,
        isBlocked: taskData.isBlocked,
        blockedReason: taskData.blockedReason,
        checklist: taskData.checklist ?? [],
      }),
    (board, updated) => ({
      ...board,
      issues: board.issues.map((issue) => (issue.id === updated.id ? updated : issue)),
    })
  ).then((updated) => toKanbanTask(updated, taskData.status));
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
  orderedTasks: IKanbanTask[],
  allowIncompleteChecklist = false
) {
  const index = orderedTasks.findIndex((item) => item.id === task.id);
  const beforeIssueId = orderedTasks[index + 1]?.id;
  const afterIssueId = orderedTasks[index - 1]?.id;
  const queryClient = getQueryClient();
  const queryKey = boardKey(projectId);
  const previous = queryClient.getQueryData<BoardResponseDto>(queryKey);
  const cancellation = queryClient.cancelQueries({ queryKey });
  const orderedIssueIds = new Set(orderedTasks.map((item) => String(item.id)));

  updateBoardCache(projectId, (board) => {
    const issueById = new Map(board.issues.map((issue) => [issue.id, issue]));
    const movedIssue = issueById.get(String(task.id));
    const orderedIssues = orderedTasks.flatMap((orderedTask) => {
      const issue = issueById.get(String(orderedTask.id));
      if (!issue) return [];
      return [
        issue.id === String(task.id) ? { ...issue, columnId: String(targetColumnId) } : issue,
      ];
    });
    const untouchedIssues = board.issues.filter(
      (issue) => !orderedIssueIds.has(issue.id) && issue.id !== String(task.id)
    );

    return {
      ...board,
      issues: movedIssue ? [...untouchedIssues, ...orderedIssues] : board.issues,
    };
  });

  try {
    await cancellation;
    const updated = await moveIssue(String(task.id), {
      version: task.version,
      targetColumnId: String(targetColumnId),
      sprintId: task.sprintId ?? undefined,
      beforeIssueId: beforeIssueId ? String(beforeIssueId) : undefined,
      afterIssueId: afterIssueId ? String(afterIssueId) : undefined,
      allowIncompleteChecklist,
    });
    updateBoardCache(projectId, (board) => ({
      ...board,
      issues: board.issues.map((issue) => (issue.id === updated.id ? updated : issue)),
    }));
    return updated;
  } catch (error) {
    if (previous) queryClient.setQueryData(queryKey, previous);
    throw error;
  } finally {
    await queryClient.invalidateQueries({ queryKey });
  }
}

export async function undoTaskMove(
  projectId: string,
  originalTask: IKanbanTask,
  movedVersion: number,
  originalColumnId: UniqueIdentifier,
  originalOrderedTasks: IKanbanTask[]
) {
  const latestTask = { ...originalTask, version: movedVersion };
  const restoredOrder = originalOrderedTasks.map((task) =>
    task.id === originalTask.id ? latestTask : task
  );
  return persistTaskMove(projectId, latestTask, originalColumnId, restoredOrder);
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

export async function restoreTask(projectId: string, task: IKanbanTask) {
  return optimisticMutation(
    projectId,
    (board) => board,
    () => restoreIssue(String(task.id), { version: task.version }),
    (board, restored) => ({ ...board, issues: [restored, ...board.issues] })
  );
}

export async function duplicateTask(projectId: string, task: IKanbanTask) {
  return optimisticMutation(
    projectId,
    (board) => board,
    () => duplicateIssue(String(task.id), { version: task.version }),
    (board, duplicate) => ({ ...board, issues: [duplicate, ...board.issues] })
  );
}

export async function refetchBoard(projectId: string) {
  const sprintId = activeSprintIdForProject(projectId);
  const board = await getBoard(projectId, sprintId ? { sprintId } : undefined);
  getQueryClient().setQueryData(boardKey(projectId), board);
}
