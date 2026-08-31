import type { IKanban, IKanbanTask } from 'src/types/kanban';

import { it, expect, describe } from 'vitest';

import {
  projectBoard,
  countActiveFilters,
  DEFAULT_BOARD_FILTERS,
  applyProjectDoneRetention,
} from './board-filter';

const NOW = new Date('2026-09-01T12:00:00.000Z');

function task(id: string, overrides: Partial<IKanbanTask> & Record<string, unknown> = {}) {
  return {
    id,
    name: `Task ${id}`,
    description: '',
    status: 'Todo',
    priority: 'medium',
    labels: [],
    version: 1,
    sprintId: null,
    storyPoints: null,
    attachments: [],
    comments: [],
    assignee: [],
    due: [null, null],
    reporter: { id: 'owner', name: 'Owner', avatarUrl: '' },
    ...overrides,
  } as IKanbanTask;
}

function board(tasks: IKanbanTask[]): IKanban {
  return {
    projectId: 'project-1',
    projectName: 'Product',
    skippedIssueCount: 0,
    columns: [
      {
        id: 'todo',
        projectId: 'project-1',
        name: 'Todo',
        category: 'todo',
        version: 1,
        wipLimit: null,
      },
      {
        id: 'doing',
        projectId: 'project-1',
        name: 'Doing',
        category: 'in_progress',
        version: 1,
        wipLimit: null,
      },
      {
        id: 'done',
        projectId: 'project-1',
        name: 'Done',
        category: 'done',
        version: 1,
        wipLimit: null,
      },
    ],
    tasks: { todo: tasks, doing: [], done: [] },
  };
}

describe('projectBoard', () => {
  it('combines search and dimensions with AND semantics', () => {
    const source = board([
      task('match', {
        name: 'Fix sign in',
        description: 'Google callback',
        type: 'bug',
        priority: 'urgent',
        labels: ['auth', 'frontend'],
        isBlocked: true,
        sprintId: 'sprint-1',
        dueDate: '2026-09-05T00:00:00.000Z',
      }),
      task('wrong-priority', {
        name: 'Fix sign in',
        type: 'bug',
        priority: 'low',
        labels: ['auth'],
        isBlocked: true,
        sprintId: 'sprint-1',
        dueDate: '2026-09-05T00:00:00.000Z',
      }),
    ]);

    const result = projectBoard(
      source,
      {
        ...DEFAULT_BOARD_FILTERS,
        query: 'callback',
        types: ['bug'],
        priorities: ['urgent'],
        labels: ['auth', 'frontend'],
        due: 'week',
        blocked: 'blocked',
        sprint: 'assigned',
      },
      { now: NOW }
    );

    expect(result.tasks.todo.map((item) => item.id)).toEqual(['match']);
  });

  it('uses OR within a multi-select dimension while keeping different dimensions as AND', () => {
    const source = board([
      task('auth-urgent', { labels: ['auth'], priority: 'urgent' }),
      task('frontend-urgent', { labels: ['frontend'], priority: 'urgent' }),
      task('auth-low', { labels: ['auth'], priority: 'low' }),
      task('other-urgent', { labels: ['backend'], priority: 'urgent' }),
    ]);

    const result = projectBoard(source, {
      ...DEFAULT_BOARD_FILTERS,
      labels: ['auth', 'frontend'],
      priorities: ['urgent'],
    });

    expect(result.tasks.todo.map((item) => item.id)).toEqual(['auth-urgent', 'frontend-urgent']);
  });

  it('filters by one specific Sprint ID', () => {
    const source = board([
      task('sprint-a', { sprintId: 'sprint-a-id' }),
      task('sprint-b', { sprintId: 'sprint-b-id' }),
      task('backlog'),
    ]);

    const result = projectBoard(source, {
      ...DEFAULT_BOARD_FILTERS,
      sprint: 'sprint:sprint-b-id',
    });

    expect(result.tasks.todo.map((item) => item.id)).toEqual(['sprint-b']);
  });

  it('uses union semantics for Focus and excludes completed work', () => {
    const source = board([]);
    source.tasks.todo = [
      task('blocked', { isBlocked: true }),
      task('due-soon', { dueDate: '2026-09-04T00:00:00.000Z' }),
      task('later', { dueDate: '2026-10-01T00:00:00.000Z' }),
    ];
    source.tasks.doing = [task('in-progress')];
    source.tasks.done = [task('completed', { isBlocked: true })];

    const result = projectBoard(source, { ...DEFAULT_BOARD_FILTERS, focus: true }, { now: NOW });

    expect(result.tasks.todo.map((item) => item.id)).toEqual(['blocked', 'due-soon']);
    expect(result.tasks.doing.map((item) => item.id)).toEqual(['in-progress']);
    expect(result.tasks.done).toEqual([]);
  });

  it('hides old completed tasks using the chosen retention and can reveal them', () => {
    const source = board([]);
    source.tasks.done = [
      task('recent', { completedAt: '2026-08-25T12:00:00.000Z' }),
      task('old', { completedAt: '2026-07-01T12:00:00.000Z' }),
    ];

    const hidden = projectBoard(source, DEFAULT_BOARD_FILTERS, { now: NOW });
    const shown = projectBoard(
      source,
      { ...DEFAULT_BOARD_FILTERS, showOlderDone: true },
      { now: NOW }
    );

    expect(hidden.tasks.done.map((item) => item.id)).toEqual(['recent']);
    expect(shown.tasks.done).toHaveLength(2);
  });

  it('projects a single column for mobile without mutating the source', () => {
    const source = board([task('one')]);
    const result = projectBoard(source, DEFAULT_BOARD_FILTERS, { mobileColumnId: 'doing' });

    expect(result.columns.map((column) => column.id)).toEqual(['doing']);
    expect(Object.keys(result.tasks)).toEqual(['doing']);
    expect(source.columns).toHaveLength(3);
  });

  it('projects 2,000 issues in under 150ms', () => {
    const source = board(
      Array.from({ length: 2_000 }, (_, index) =>
        task(String(index), {
          name: index % 10 === 0 ? `Target ${index}` : `Ordinary ${index}`,
          description: 'A searchable task description',
          labels: index % 2 ? ['frontend'] : ['backend'],
          type: index % 3 ? 'task' : 'bug',
        })
      )
    );

    const startedAt = performance.now();
    const result = projectBoard(source, {
      ...DEFAULT_BOARD_FILTERS,
      query: 'target',
      labels: ['backend'],
    });
    const duration = performance.now() - startedAt;

    expect(result.tasks.todo.length).toBeGreaterThan(0);
    expect(duration).toBeLessThan(150);
  });
});

describe('countActiveFilters', () => {
  it('counts active values and supports clear-all state', () => {
    expect(countActiveFilters(DEFAULT_BOARD_FILTERS)).toBe(0);
    expect(
      countActiveFilters({
        ...DEFAULT_BOARD_FILTERS,
        query: 'auth',
        types: ['bug', 'task'],
        focus: true,
      })
    ).toBe(4);
  });

  it('treats the active Project retention as the clear-state baseline', () => {
    expect(countActiveFilters({ ...DEFAULT_BOARD_FILTERS, retentionDays: 7 }, 7)).toBe(0);
  });
});

describe('applyProjectDoneRetention', () => {
  it('switches to the active Project setting without clearing the local reveal override', () => {
    const current = {
      ...DEFAULT_BOARD_FILTERS,
      query: 'auth',
      retentionDays: 30 as const,
      showOlderDone: true,
    };

    expect(applyProjectDoneRetention(current, 7)).toEqual({
      ...current,
      retentionDays: 7,
      showOlderDone: true,
    });
  });
});
