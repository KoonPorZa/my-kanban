import type { IKanbanTask } from 'src/types/kanban';

import { vi, it, expect, describe } from 'vitest';

import { TaskSaveQueue } from './task-save-queue';

describe('TaskSaveQueue', () => {
  it('serializes rapid edits and sends the latest saved version', async () => {
    let releaseFirst!: () => void;
    const save = vi
      .fn<(task: IKanbanTask) => Promise<IKanbanTask>>()
      .mockImplementationOnce(
        (input) =>
          new Promise((resolve) => {
            releaseFirst = () => resolve({ ...input, version: 2 });
          })
      )
      .mockImplementationOnce(async (input) => ({ ...input, version: 3 }));
    const queue = new TaskSaveQueue(task(), save, vi.fn());

    const first = queue.enqueue({ priority: 'high' });
    const second = queue.enqueue({ description: 'Latest description' });
    releaseFirst();
    await Promise.all([first, second]);

    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[0][0]).toMatchObject({ version: 1, priority: 'high' });
    expect(save.mock.calls[1][0]).toMatchObject({
      version: 2,
      priority: 'high',
      description: 'Latest description',
    });
  });

  it('carries buffered edits into the next versioned save', async () => {
    const save = vi.fn(async (input: IKanbanTask) => ({ ...input, version: 2 }));
    const queue = new TaskSaveQueue(task(), save, vi.fn());

    await Promise.all([
      queue.enqueue({ priority: 'urgent' }),
      queue.enqueue({ labels: ['release'] }),
    ]);

    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[1][0]).toMatchObject({ version: 2, labels: ['release'] });
  });

  it('does not regress to an older task version received from a parent refresh', async () => {
    const save = vi.fn(async (input: IKanbanTask) => ({ ...input, version: input.version + 1 }));
    const queue = new TaskSaveQueue(task(), save, vi.fn());

    await queue.enqueue({ priority: 'high' });
    queue.sync({ ...task(), version: 1, description: 'Stale server value' });
    await queue.enqueue({ labels: ['release'] });

    expect(save.mock.calls[1][0]).toMatchObject({
      version: 2,
      priority: 'high',
      labels: ['release'],
    });
    expect(save.mock.calls[1][0].description).not.toBe('Stale server value');
  });
});

function task(): IKanbanTask {
  return {
    id: 'task-1',
    version: 1,
    sprintId: null,
    storyPoints: null,
    name: 'Task',
    status: 'Custom workflow',
    type: 'task',
    priority: 'medium',
    labels: [],
    dueDate: null,
    isBlocked: false,
    blockedReason: null,
    checklist: [],
    checklistIncompleteCount: 0,
    completedAt: null,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    description: '',
    attachments: [],
    comments: [],
    assignee: [],
    due: [null, null],
    reporter: { id: '', name: '', avatarUrl: '' },
  };
}
