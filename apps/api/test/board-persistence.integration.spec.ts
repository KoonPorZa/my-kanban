import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { BoardsService } from '../src/boards/boards.service';
import { PrismaBoardsRepository } from '../src/boards/prisma-boards.repository';
import { PrismaService } from '../src/database/prisma.service';
import { IssuesService } from '../src/issues/issues.service';
import { PrismaIssuesRepository } from '../src/issues/prisma-issues.repository';
import { TaskPriority } from '../src/issues/dto/issue-mutation.dto';
import { ResourceNotFoundError, VersionConflictError } from '../src/common/domain/domain-errors';

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
    });
    expect(created.version).toBe(1);

    const updated = await issues.update(owner.userId, created.id, {
      version: created.version,
      title: 'Persisted task',
      priority: TaskPriority.urgent,
    });
    expect(updated).toMatchObject({ title: 'Persisted task', priority: 'urgent', version: 2 });

    await expect(
      issues.update(owner.userId, created.id, {
        version: created.version,
        title: 'Stale update',
      })
    ).rejects.toBeInstanceOf(VersionConflictError);

    const moved = await issues.move(owner.userId, created.id, {
      version: updated.version,
      targetColumnId: owner.doneColumnId,
    });
    expect(moved.columnId).toBe(owner.doneColumnId);
    expect(moved.completedAt).not.toBeNull();

    const boardAfterMove = await boards.get(owner.userId, owner.projectId);
    expect(boardAfterMove.issues).toContainEqual(expect.objectContaining({ id: created.id }));

    await issues.archive(owner.userId, created.id, moved.version);
    const boardAfterArchive = await boards.get(owner.userId, owner.projectId);
    expect(boardAfterArchive.issues).not.toContainEqual(
      expect.objectContaining({ id: created.id })
    );
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
    const moved = await boards.moveColumn(owner.userId, created.id, {
      version: renamed.version,
      afterColumnId: owner.doneColumnId,
    });

    const task = await issues.create(owner.userId, owner.projectId, {
      title: 'Clear me',
      columnId: moved.id,
    });
    expect(task.columnId).toBe(moved.id);

    const cleared = await boards.clearColumn(owner.userId, moved.id, moved.version);
    const boardAfterClear = await boards.get(owner.userId, owner.projectId);
    expect(boardAfterClear.issues).not.toContainEqual(expect.objectContaining({ id: task.id }));

    await boards.archiveColumn(owner.userId, moved.id, cleared.version);
    const boardAfterArchive = await boards.get(owner.userId, owner.projectId);
    expect(boardAfterArchive.columns).not.toContainEqual(expect.objectContaining({ id: moved.id }));
  });

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
