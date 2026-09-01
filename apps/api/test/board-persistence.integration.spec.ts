import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { BoardsService } from '../src/boards/boards.service';
import { PrismaBoardsRepository } from '../src/boards/prisma-boards.repository';
import { PrismaService } from '../src/database/prisma.service';
import { IssuesService } from '../src/issues/issues.service';
import { PrismaIssuesRepository } from '../src/issues/prisma-issues.repository';
import { TaskPriority } from '../src/issues/dto/issue-mutation.dto';
import {
  ResourceNotFoundError,
  VersionConflictError,
  DomainValidationError,
} from '../src/common/domain/domain-errors';

describe('Board persistence integration', () => {
  let prisma: PrismaService;
  let boards: BoardsService;
  let issues: IssuesService;
  const cleanupUserIds: string[] = [];

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.onModuleInit();
    await cleanupIntegrationFixtures();
    boards = new BoardsService(new PrismaBoardsRepository(prisma));
    issues = new IssuesService(new PrismaIssuesRepository(prisma));
  });

  afterAll(async () => {
    if (cleanupUserIds.length) {
      await prisma.workspace.deleteMany({ where: { ownerId: { in: cleanupUserIds } } });
      await prisma.user.deleteMany({ where: { id: { in: cleanupUserIds } } });
    }
    await prisma.onModuleDestroy();
  });

  it('persists create, update, move, and archive operations with version checks', async () => {
    const owner = await createBoardFixture('owner');
    const outsider = await createBoardFixture('outsider');

    await expect(boards.get(outsider.userId, owner.projectId)).rejects.toBeInstanceOf(
      ResourceNotFoundError
    );

    const created = await issues.create(owner.userId, owner.projectId, {
      title: 'Persist this task',
      columnId: owner.todoColumnId,
      description: 'Stored in PostgreSQL',
      priority: TaskPriority.high,
      labels: ['api', 'persistence'],
      checklist: [
        { title: 'Persist checklist', isCompleted: true },
        { title: 'Verify Done guard' },
      ],
    });
    expect(created.version).toBe(1);
    expect(created).toMatchObject({ checklistIncompleteCount: 1 });
    expect(created.checklist.map(({ title }) => title)).toEqual([
      'Persist checklist',
      'Verify Done guard',
    ]);

    const updated = await issues.update(owner.userId, created.id, {
      version: created.version,
      title: 'Persisted task',
      priority: TaskPriority.urgent,
      checklist: [
        { ...created.checklist[1], isCompleted: false },
        { ...created.checklist[0], isCompleted: true },
      ],
    });
    expect(updated).toMatchObject({ title: 'Persisted task', priority: 'urgent', version: 2 });
    expect(updated.checklist.map(({ title }) => title)).toEqual([
      'Verify Done guard',
      'Persist checklist',
    ]);

    await expect(
      issues.update(owner.userId, created.id, {
        version: created.version,
        title: 'Stale update',
      })
    ).rejects.toBeInstanceOf(VersionConflictError);

    await expect(
      issues.move(owner.userId, created.id, {
        version: updated.version,
        targetColumnId: owner.doneColumnId,
      })
    ).rejects.toThrow('allowIncompleteChecklist');

    const duplicate = await issues.duplicate(owner.userId, created.id, updated.version);
    expect(duplicate).toMatchObject({
      title: 'Persisted task (copy)',
      checklistIncompleteCount: 1,
    });
    expect(duplicate.checklist.map(({ id }) => id)).not.toEqual(
      created.checklist.map(({ id }) => id)
    );

    const moved = await issues.move(owner.userId, created.id, {
      version: updated.version,
      targetColumnId: owner.doneColumnId,
      allowIncompleteChecklist: true,
    });
    expect(moved.columnId).toBe(owner.doneColumnId);
    expect(moved.completedAt).not.toBeNull();

    const boardAfterMove = await boards.get(owner.userId, owner.projectId);
    expect(boardAfterMove.issues).toContainEqual(expect.objectContaining({ id: created.id }));

    const archived = await issues.archive(owner.userId, created.id, moved.version);
    const boardAfterArchive = await boards.get(owner.userId, owner.projectId);
    expect(boardAfterArchive.issues).not.toContainEqual(
      expect.objectContaining({ id: created.id })
    );

    await expect(
      issues.restore(outsider.userId, created.id, archived.version)
    ).rejects.toBeInstanceOf(ResourceNotFoundError);
    const restored = await issues.restore(owner.userId, created.id, archived.version);
    expect(restored).toMatchObject({ id: created.id, version: archived.version + 1 });
  });

  it('persists column creation, rename, reorder, clear, and archive', async () => {
    const owner = await createBoardFixture('columns');
    const created = await boards.createColumn(owner.userId, owner.projectId, {
      name: 'Review',
      beforeColumnId: owner.doneColumnId,
      afterColumnId: owner.todoColumnId,
    });
    const renamed = await boards.updateColumn(owner.userId, created.id, {
      version: created.version,
      name: 'Ready for review',
    });
    const qa = await boards.createColumn(owner.userId, owner.projectId, { name: 'QA' });
    const moved = await boards.moveColumn(owner.userId, created.id, {
      version: renamed.version,
      beforeColumnId: owner.doneColumnId,
      afterColumnId: qa.id,
    });

    const task = await issues.create(owner.userId, owner.projectId, {
      title: 'Clear me',
      columnId: moved.id,
    });
    expect(task.columnId).toBe(moved.id);

    const cleared = await boards.clearColumn(owner.userId, moved.id, moved.version);
    const boardAfterClear = await boards.get(owner.userId, owner.projectId);
    expect(boardAfterClear.issues).not.toContainEqual(expect.objectContaining({ id: task.id }));

    await boards.archiveColumn(owner.userId, moved.id, { version: cleared.version });
    const boardAfterArchive = await boards.get(owner.userId, owner.projectId);
    expect(boardAfterArchive.columns).not.toContainEqual(expect.objectContaining({ id: moved.id }));
  });

  it('restores an archived task to its original board position', async () => {
    const owner = await createBoardFixture('restore-position');
    const first = await issues.create(owner.userId, owner.projectId, {
      title: 'First',
      columnId: owner.todoColumnId,
    });
    const middle = await issues.create(owner.userId, owner.projectId, {
      title: 'Middle',
      columnId: owner.todoColumnId,
    });
    const last = await issues.create(owner.userId, owner.projectId, {
      title: 'Last',
      columnId: owner.todoColumnId,
    });

    const archived = await issues.archive(owner.userId, middle.id, middle.version);
    await issues.restore(owner.userId, middle.id, archived.version);

    const board = await boards.get(owner.userId, owner.projectId);
    expect(
      board.issues
        .filter(({ id }) => [first.id, middle.id, last.id].includes(id))
        .map(({ title }) => title)
    ).toEqual(['First', 'Middle', 'Last']);
  });

  it('persists one backlog reorder within its Board column', async () => {
    const owner = await createBoardFixture('backlog-reorder');
    const first = await issues.create(owner.userId, owner.projectId, {
      title: 'Backlog first',
      columnId: owner.todoColumnId,
    });
    const second = await issues.create(owner.userId, owner.projectId, {
      title: 'Backlog second',
      columnId: owner.todoColumnId,
    });
    const moved = await issues.create(owner.userId, owner.projectId, {
      title: 'Backlog moved',
      columnId: owner.todoColumnId,
    });

    const reordered = await issues.move(owner.userId, moved.id, {
      version: moved.version,
      targetColumnId: owner.todoColumnId,
      beforeIssueId: first.id,
    });

    expect(reordered.version).toBe(moved.version + 1);
    const board = await boards.get(owner.userId, owner.projectId);
    expect(
      board.issues
        .filter(({ id }) => [first.id, second.id, moved.id].includes(id))
        .map(({ title }) => title)
    ).toEqual(['Backlog moved', 'Backlog first', 'Backlog second']);
  });

  it('clears only Active Sprint tasks and blocks column deletion in Scrum mode', async () => {
    const owner = await createBoardFixture('scrum-clear');
    await prisma.project.update({ where: { id: owner.projectId }, data: { mode: 'scrum' } });
    const [activeSprint, otherSprint] = await Promise.all([
      createSprint(owner.projectId, 'Active', 'active'),
      createSprint(owner.projectId, 'Other', 'planned'),
    ]);
    const activeTask = await issues.create(owner.userId, owner.projectId, {
      title: 'Clear active task',
      columnId: owner.todoColumnId,
    });
    const backlogTask = await issues.create(owner.userId, owner.projectId, {
      title: 'Keep backlog task',
      columnId: owner.todoColumnId,
    });
    const otherSprintTask = await issues.create(owner.userId, owner.projectId, {
      title: 'Keep other Sprint task',
      columnId: owner.todoColumnId,
    });
    await Promise.all([
      prisma.issue.update({ where: { id: activeTask.id }, data: { sprintId: activeSprint.id } }),
      prisma.issue.update({
        where: { id: otherSprintTask.id },
        data: { sprintId: otherSprint.id },
      }),
    ]);

    const column = (await boards.get(owner.userId, owner.projectId)).columns.find(
      ({ id }) => id === owner.todoColumnId
    )!;
    await expect(boards.clearColumn(owner.userId, column.id, column.version)).rejects.toThrow(
      'sprintId is required to clear a column in Scrum mode'
    );
    const cleared = await boards.clearColumn(
      owner.userId,
      column.id,
      column.version,
      activeSprint.id
    );
    const boardAfterClear = await boards.get(owner.userId, owner.projectId);
    expect(boardAfterClear.issues.map(({ id }) => id)).toEqual(
      expect.arrayContaining([backlogTask.id, otherSprintTask.id])
    );
    expect(boardAfterClear.issues).not.toContainEqual(
      expect.objectContaining({ id: activeTask.id })
    );
    await expect(
      boards.archiveColumn(owner.userId, column.id, { version: cleared.version })
    ).rejects.toThrow('The first column must be a To do column');
  });

  it('keeps edge-column and Done WIP invariants', async () => {
    const owner = await createBoardFixture('column-invariants');
    const review = await boards.createColumn(owner.userId, owner.projectId, {
      name: 'Review',
      wipLimit: 2,
    });
    const board = await boards.get(owner.userId, owner.projectId);
    expect(board.columns.map(({ id }) => id)).toEqual([
      owner.todoColumnId,
      review.id,
      owner.doneColumnId,
    ]);
    await expect(
      boards.moveColumn(owner.userId, owner.todoColumnId, {
        version: board.columns[0].version,
        afterColumnId: review.id,
        beforeColumnId: owner.doneColumnId,
      })
    ).rejects.toThrow('The first column must be a To do column');
    await expect(
      boards.updateColumn(owner.userId, owner.doneColumnId, { version: 1, wipLimit: 1 })
    ).rejects.toThrow('Done columns cannot have a WIP limit');
  });

  it('requires a destination and preserves tasks when archiving an internal column', async () => {
    const owner = await createBoardFixture('archive-destination');
    const review = await boards.createColumn(owner.userId, owner.projectId, { name: 'Review' });
    const task = await issues.create(owner.userId, owner.projectId, {
      title: 'Preserve me',
      columnId: review.id,
      checklist: [{ title: 'Finish before Done' }],
    });

    await expect(
      boards.archiveColumn(owner.userId, review.id, { version: review.version })
    ).rejects.toThrow('destinationColumnId is required');
    await expect(
      boards.archiveColumn(owner.userId, review.id, {
        version: review.version,
        destinationColumnId: owner.doneColumnId,
      })
    ).rejects.toThrow('allowIncompleteChecklist');
    await boards.archiveColumn(owner.userId, review.id, {
      version: review.version,
      destinationColumnId: owner.doneColumnId,
      allowIncompleteChecklist: true,
    });

    const preserved = await prisma.issue.findUniqueOrThrow({ where: { id: task.id } });
    expect(preserved).toMatchObject({ columnId: owner.doneColumnId, archivedAt: null });
    expect(preserved.completedAt).not.toBeNull();
  });

  it('restores an archived task to the first active column when its original column is archived', async () => {
    const owner = await createBoardFixture('restore-archived-column');
    const review = await boards.createColumn(owner.userId, owner.projectId, { name: 'Review' });
    const task = await issues.create(owner.userId, owner.projectId, {
      title: 'Recover after column archive',
      columnId: review.id,
    });
    const archivedTask = await issues.archive(owner.userId, task.id, task.version);
    await boards.archiveColumn(owner.userId, review.id, { version: review.version });

    const restored = await issues.restore(owner.userId, task.id, archivedTask.version);
    expect(restored).toMatchObject({
      id: task.id,
      columnId: owner.todoColumnId,
      version: archivedTask.version + 1,
    });
  });

  it('reorders visible Sprint neighbors separated by hidden tasks', async () => {
    const owner = await createBoardFixture('scrum-reorder');
    const sprint = await createSprint(owner.projectId, 'Active reorder', 'active');
    const first = await issues.create(owner.userId, owner.projectId, {
      title: 'First visible',
      columnId: owner.todoColumnId,
    });
    const hidden = await issues.create(owner.userId, owner.projectId, {
      title: 'Hidden backlog',
      columnId: owner.todoColumnId,
    });
    const last = await issues.create(owner.userId, owner.projectId, {
      title: 'Last visible',
      columnId: owner.todoColumnId,
    });
    const moved = await issues.create(owner.userId, owner.projectId, {
      title: 'Move between visible tasks',
      columnId: owner.doneColumnId,
    });
    await prisma.issue.updateMany({
      where: { id: { in: [first.id, last.id, moved.id] } },
      data: { sprintId: sprint.id },
    });

    const reordered = await issues.move(owner.userId, moved.id, {
      version: moved.version,
      targetColumnId: owner.todoColumnId,
      sprintId: sprint.id,
      beforeIssueId: last.id,
      afterIssueId: first.id,
    });
    expect(reordered.columnId).toBe(owner.todoColumnId);

    await expect(
      issues.move(owner.userId, reordered.id, {
        version: reordered.version,
        targetColumnId: owner.todoColumnId,
        sprintId: sprint.id,
        beforeIssueId: hidden.id,
      })
    ).rejects.toBeInstanceOf(DomainValidationError);
  });

  function createSprint(projectId: string, name: string, status: 'planned' | 'active') {
    return prisma.sprint.create({
      data: {
        projectId,
        name,
        status,
        startDate: new Date('2026-09-01'),
        endDate: new Date('2026-09-14'),
      },
    });
  }

  async function createBoardFixture(label: string) {
    const user = await prisma.user.create({
      data: { displayName: `Integration board persistence ${label}` },
    });
    cleanupUserIds.push(user.id);
    const workspace = await prisma.workspace.create({
      data: { ownerId: user.id, name: `Workspace ${label}` },
    });
    const project = await prisma.project.create({
      data: { workspaceId: workspace.id, name: `Project ${label}` },
    });
    const [todo, done] = await Promise.all([
      prisma.boardColumn.create({
        data: { projectId: project.id, name: 'To do', category: 'todo', rank: 1024n },
      }),
      prisma.boardColumn.create({
        data: { projectId: project.id, name: 'Done', category: 'done', rank: 2048n },
      }),
    ]);

    await prisma.workspace.update({
      where: { id: workspace.id },
      data: { activeProjectId: project.id },
    });

    return {
      userId: user.id,
      projectId: project.id,
      todoColumnId: todo.id,
      doneColumnId: done.id,
    };
  }

  async function cleanupIntegrationFixtures() {
    const users = await prisma.user.findMany({
      where: { displayName: { startsWith: 'Integration board persistence ' } },
      select: { id: true },
    });
    const userIds = users.map(({ id }) => id);
    if (!userIds.length) return;

    await prisma.workspace.deleteMany({ where: { ownerId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }
});
