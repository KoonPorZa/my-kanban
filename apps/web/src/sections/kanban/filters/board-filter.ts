import type { IKanban, IKanbanTask } from 'src/types/kanban';

export type DueFilter = 'all' | 'overdue' | 'today' | 'week' | 'none';
export type BlockedFilter = 'all' | 'blocked' | 'unblocked';
export type SprintFilter = 'all' | 'backlog' | 'assigned' | `sprint:${string}`;
export type DoneRetentionDays = 7 | 14 | 30;

export type BoardFilterState = {
  query: string;
  types: string[];
  priorities: string[];
  labels: string[];
  due: DueFilter;
  blocked: BlockedFilter;
  sprint: SprintFilter;
  focus: boolean;
  retentionDays: DoneRetentionDays;
  showOlderDone: boolean;
};

type FilterableTask = Omit<IKanbanTask, 'dueDate'> & {
  type?: string;
  isBlocked?: boolean;
  blockedReason?: string | null;
  dueDate?: string | null;
  completedAt?: string | null;
};

export const DEFAULT_BOARD_FILTERS: BoardFilterState = {
  query: '',
  types: [],
  priorities: [],
  labels: [],
  due: 'all',
  blocked: 'all',
  sprint: 'all',
  focus: false,
  retentionDays: 30,
  showOlderDone: false,
};

export function applyProjectDoneRetention(
  filters: BoardFilterState,
  retentionDays: DoneRetentionDays
): BoardFilterState {
  if (filters.retentionDays === retentionDays) return filters;

  return { ...filters, retentionDays };
}

const DAY_IN_MS = 86_400_000;

function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
}

function taskDueDate(task: FilterableTask) {
  const value = 'dueDate' in task ? task.dueDate : task.due?.[1];
  if (!value) return null;

  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
}

function matchesDue(task: FilterableTask, due: DueFilter, now: Date) {
  if (due === 'all') return true;

  const timestamp = taskDueDate(task);
  if (due === 'none') return timestamp === null;
  if (timestamp === null) return false;

  const today = startOfDay(now);
  const dueDay = startOfDay(new Date(timestamp));

  if (due === 'overdue') return dueDay < today;
  if (due === 'today') return dueDay === today;

  return dueDay >= today && dueDay <= today + 7 * DAY_IN_MS;
}

function matchesFocus(task: FilterableTask, category: string, now: Date) {
  if (category === 'done') return false;

  const dueDate = taskDueDate(task);
  const today = startOfDay(now);
  const dueSoon = dueDate !== null && dueDate <= today + 7 * DAY_IN_MS;

  return category === 'in_progress' || Boolean(task.isBlocked) || dueSoon;
}

function isOlderDoneTask(task: FilterableTask, retentionDays: DoneRetentionDays, now: Date) {
  if (!task.completedAt) return false;

  const completedAt = new Date(task.completedAt).getTime();
  if (Number.isNaN(completedAt)) return false;

  return completedAt < now.getTime() - retentionDays * DAY_IN_MS;
}

function matchesTask(task: FilterableTask, category: string, filters: BoardFilterState, now: Date) {
  if (category === 'done' && !filters.showOlderDone) {
    if (isOlderDoneTask(task, filters.retentionDays, now)) return false;
  }

  const query = filters.query.trim().toLocaleLowerCase();
  if (query) {
    const searchable = `${task.name} ${task.description ?? ''}`.toLocaleLowerCase();
    if (!searchable.includes(query)) return false;
  }

  if (filters.types.length && !filters.types.includes(task.type ?? 'task')) return false;
  if (filters.priorities.length && !filters.priorities.includes(task.priority)) return false;
  if (filters.labels.length && !filters.labels.some((label) => task.labels.includes(label))) {
    return false;
  }
  if (!matchesDue(task, filters.due, now)) return false;

  if (filters.blocked === 'blocked' && !task.isBlocked) return false;
  if (filters.blocked === 'unblocked' && task.isBlocked) return false;

  if (filters.sprint === 'backlog' && task.sprintId !== null) return false;
  if (filters.sprint === 'assigned' && task.sprintId === null) return false;
  if (filters.sprint.startsWith('sprint:') && task.sprintId !== filters.sprint.slice(7))
    return false;

  if (filters.focus && !matchesFocus(task, category, now)) return false;

  return true;
}

export function projectBoard(
  board: IKanban,
  filters: BoardFilterState,
  options: { mobileColumnId?: string; now?: Date } = {}
): IKanban {
  const now = options.now ?? new Date();
  const columns = options.mobileColumnId
    ? board.columns.filter((column) => String(column.id) === options.mobileColumnId)
    : board.columns;

  return {
    ...board,
    columns,
    tasks: Object.fromEntries(
      columns.map((column) => [
        column.id,
        (board.tasks[column.id] ?? []).filter((task) =>
          matchesTask(task as FilterableTask, column.category, filters, now)
        ),
      ])
    ),
  };
}

export function countActiveFilters(
  filters: BoardFilterState,
  defaultRetentionDays: DoneRetentionDays = DEFAULT_BOARD_FILTERS.retentionDays
) {
  return (
    Number(Boolean(filters.query.trim())) +
    filters.types.length +
    filters.priorities.length +
    filters.labels.length +
    Number(filters.due !== 'all') +
    Number(filters.blocked !== 'all') +
    Number(filters.sprint !== 'all') +
    Number(filters.focus) +
    Number(filters.retentionDays !== defaultRetentionDays) +
    Number(filters.showOlderDone)
  );
}

export function collectBoardLabels(board: IKanban) {
  return [
    ...new Set(Object.values(board.tasks).flatMap((tasks) => tasks.flatMap((task) => task.labels))),
  ].sort((left, right) => left.localeCompare(right));
}
