'use client';

import type { UniqueIdentifier } from '@dnd-kit/core';
import type { IKanban, IKanbanTask, IKanbanColumn } from 'src/types/kanban';

import { useQuery } from '@tanstack/react-query';

import { getQueryClient } from 'src/lib/query-client';

type BoardData = {
  board: IKanban;
};

const BOARD_QUERY_KEY = ['kanban', 'board'] as const;

const now = new Date();
const tomorrow = new Date(now.getTime() + 86_400_000);

const initialBoard: IKanban = {
  columns: [
    { id: 'backlog', name: 'Backlog' },
    { id: 'todo', name: 'To do' },
    { id: 'in-progress', name: 'In progress' },
    { id: 'done', name: 'Done' },
  ],
  tasks: {
    backlog: [createSeedTask('seed-1', 'Capture your next task', 'Backlog')],
    todo: [createSeedTask('seed-2', 'Plan the first sprint', 'To do')],
    'in-progress': [],
    done: [],
  },
};

function createSeedTask(id: string, name: string, status: string): IKanbanTask {
  return {
    id,
    name,
    status,
    priority: 'medium',
    description: '',
    attachments: [],
    labels: [],
    comments: [],
    assignee: [],
    due: [now.toISOString(), tomorrow.toISOString()],
    reporter: { id: 'owner', name: 'Owner', avatarUrl: '' },
  };
}

function updateBoard(updater: (board: IKanban) => IKanban) {
  const queryClient = getQueryClient();
  const current = queryClient.getQueryData<BoardData>(BOARD_QUERY_KEY) ?? {
    board: initialBoard,
  };

  queryClient.setQueryData<BoardData>(BOARD_QUERY_KEY, {
    board: updater(current.board),
  });
}

export function useGetBoard() {
  const query = useQuery<BoardData>({
    queryKey: BOARD_QUERY_KEY,
    queryFn: async () => ({ board: initialBoard }),
    initialData: { board: initialBoard },
    staleTime: Number.POSITIVE_INFINITY,
  });

  return {
    board: query.data.board,
    boardLoading: query.isLoading,
    boardError: query.error,
    boardValidating: query.isFetching,
    boardEmpty: !query.isLoading && query.data.board.columns.length === 0,
  };
}

export async function createColumn(columnData: IKanbanColumn) {
  updateBoard((board) => ({
    columns: [...board.columns, columnData],
    tasks: { ...board.tasks, [columnData.id]: [] },
  }));
}

export async function updateColumn(columnId: UniqueIdentifier, columnName: string) {
  updateBoard((board) => ({
    ...board,
    columns: board.columns.map((column) =>
      column.id === columnId ? { ...column, name: columnName } : column
    ),
  }));
}

export async function moveColumn(columns: IKanbanColumn[]) {
  updateBoard((board) => ({ ...board, columns }));
}

export async function clearColumn(columnId: UniqueIdentifier) {
  updateBoard((board) => ({
    ...board,
    tasks: { ...board.tasks, [columnId]: [] },
  }));
}

export async function deleteColumn(columnId: UniqueIdentifier) {
  updateBoard((board) => {
    const tasks = { ...board.tasks };
    delete tasks[columnId];

    return {
      columns: board.columns.filter((column) => column.id !== columnId),
      tasks,
    };
  });
}

export async function createTask(columnId: UniqueIdentifier, taskData: IKanbanTask) {
  updateBoard((board) => ({
    ...board,
    tasks: {
      ...board.tasks,
      [columnId]: [taskData, ...(board.tasks[columnId] ?? [])],
    },
  }));
}

export async function updateTask(columnId: UniqueIdentifier, taskData: IKanbanTask) {
  updateBoard((board) => ({
    ...board,
    tasks: {
      ...board.tasks,
      [columnId]: (board.tasks[columnId] ?? []).map((task) =>
        task.id === taskData.id ? { ...task, ...taskData } : task
      ),
    },
  }));
}

export async function moveTask(tasks: IKanban['tasks']) {
  updateBoard((board) => ({ ...board, tasks }));
}

export async function deleteTask(columnId: UniqueIdentifier, taskId: UniqueIdentifier) {
  updateBoard((board) => ({
    ...board,
    tasks: {
      ...board.tasks,
      [columnId]: (board.tasks[columnId] ?? []).filter((task) => task.id !== taskId),
    },
  }));
}
