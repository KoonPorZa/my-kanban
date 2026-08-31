import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  DomainConflictError,
  DomainValidationError,
  ResourceNotFoundError,
  VersionConflictError,
} from '../src/common/domain/domain-errors';
import { PrismaService } from '../src/database/prisma.service';
import { PrismaBoardsRepository } from '../src/boards/prisma-boards.repository';
import { PrismaIssuesRepository } from '../src/issues/prisma-issues.repository';
import { PrismaProjectsRepository } from '../src/projects/prisma-projects.repository';
import { ProjectsService } from '../src/projects/projects.service';
import { ProjectModeDto } from '../src/projects/dto/project-mutation.dto';
import { PrismaSprintsRepository } from '../src/sprints/prisma-sprints.repository';
import { SprintsService } from '../src/sprints/sprints.service';

describe('Sprint persistence integration', () => {
  let prisma: PrismaService;
  let projects: ProjectsService;
  let sprints: SprintsService;
  let boards: PrismaBoardsRepository;
  let issues: PrismaIssuesRepository;
  const cleanupUserIds: string[] = [];

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.onModuleInit();
    await cleanupFixtures();
    projects = new ProjectsService(new PrismaProjectsRepository(prisma));
    sprints = new SprintsService(new PrismaSprintsRepository(prisma));
    boards = new PrismaBoardsRepository(prisma);
    issues = new PrismaIssuesRepository(prisma);
  });

  afterAll(async () => {
    if (cleanupUserIds.length) {
      await prisma.workspace.deleteMany({ where: { ownerId: { in: cleanupUserIds } } });
      await prisma.user.deleteMany({ where: { id: { in: cleanupUserIds } } });
    }
    await prisma.onModuleDestroy();
  });

  it('scopes Sprints to the owner and completes one atomically with velocity snapshots', async () => {
    const owner = await createFixture('lifecycle');
    const outsider = await createFixture('outsider');

    await expect(sprints.list(outsider.userId, owner.projectId)).rejects.toBeInstanceOf(
      ResourceNotFoundError
    );

    const first = await sprints.create(owner.userId, owner.projectId, {
      name: 'Sprint 1',
      goal: 'Ship the slice',
      startDate: '2026-09-01',
      endDate: '2026-09-14',
    });
    const next = await sprints.create(owner.userId, owner.projectId, {
      name: 'Sprint 2',
      goal: '',
      startDate: '2026-09-15',
      endDate: '2026-09-28',
    });
    const doneIssue = await createIssue(owner, 'Completed story', owner.doneColumnId, 8, 1024n);
    const incompleteIssue = await createIssue(
      owner,
      'Incomplete story',
      owner.todoColumnId,
      null,
      2048n
    );

    await sprints.addIssue(owner.userId, first.id, doneIssue.id);
    await sprints.addIssue(owner.userId, first.id, incompleteIssue.id);
    await expect(
      sprints.addIssue(outsider.userId, first.id, incompleteIssue.id)
    ).rejects.toBeInstanceOf(ResourceNotFoundError);
    const started = await sprints.start(owner.userId, first.id, first.version);
    expect(started).toMatchObject({
      status: 'active',
      plannedPoints: 8,
      plannedIssueCount: 2,
      issueCount: 2,
      version: 2,
    });

    const lateIssue = await createIssue(
      owner,
      'Added after Sprint start',
      owner.todoColumnId,
      5,
      3072n
    );
    await sprints.addIssue(owner.userId, first.id, lateIssue.id);
    await sprints.removeIssue(owner.userId, first.id, incompleteIssue.id);

    const scopedBoard = await boards.get(owner.userId, owner.projectId, first.id);
    expect(scopedBoard.issues.map(({ id }) => id).sort()).toEqual(
      [doneIssue.id, lateIssue.id].sort()
    );
    await expect(boards.get(owner.userId, owner.projectId, next.id)).rejects.toBeInstanceOf(
      ResourceNotFoundError
    );

    await expect(sprints.start(owner.userId, first.id, first.version)).rejects.toBeInstanceOf(
      VersionConflictError
    );

    const completed = await sprints.complete(owner.userId, first.id, {
      version: started.version,
      incompleteDestination: next.id,
    });
    expect(completed).toMatchObject({
      status: 'completed',
      completedPoints: 8,
      completedIssueCount: 1,
      incompletePoints: 5,
      incompleteIssueCount: 1,
      issueCount: 1,
      version: 3,
    });
    expect(completed.completedAt).not.toBeNull();

    const [persistedDone, persistedIncomplete, persistedLate] = await Promise.all([
      prisma.issue.findUniqueOrThrow({ where: { id: doneIssue.id } }),
      prisma.issue.findUniqueOrThrow({ where: { id: incompleteIssue.id } }),
      prisma.issue.findUniqueOrThrow({ where: { id: lateIssue.id } }),
    ]);
    expect(persistedDone.sprintId).toBe(first.id);
    expect(persistedIncomplete.sprintId).toBeNull();
    expect(persistedLate.sprintId).toBe(next.id);
  });

  it('creates a task in a Sprint atomically and preserves owner scope', async () => {
    const owner = await createFixture('atomic-create');
    const outsider = await createFixture('atomic-create-outsider');
    const sprint = await sprints.create(owner.userId, owner.projectId, {
      name: 'Quick add Sprint',
      goal: '',
      startDate: '2026-10-01',
      endDate: '2026-10-14',
    });

    const created = await sprints.createIssue(owner.userId, sprint.id, {
      title: 'Created directly in Sprint',
      columnId: owner.todoColumnId,
      storyPoints: 3,
    });
    expect(created).toMatchObject({
      projectId: owner.projectId,
      sprintId: sprint.id,
      title: 'Created directly in Sprint',
      storyPoints: 3,
    });
    await expect(
      sprints.createIssue(outsider.userId, sprint.id, {
        title: 'Cross-owner task',
        columnId: owner.todoColumnId,
      })
    ).rejects.toBeInstanceOf(ResourceNotFoundError);
    expect(await prisma.issue.count({ where: { sprintId: sprint.id } })).toBe(1);
  });

  it('assigns selected backlog tasks to a Sprint atomically', async () => {
    const owner = await createFixture('bulk-assignment');
    const outsider = await createFixture('bulk-assignment-outsider');
    const sprint = await sprints.create(owner.userId, owner.projectId, {
      name: 'Bulk Sprint',
      goal: '',
      startDate: '2026-10-15',
      endDate: '2026-10-28',
    });
    const first = await createIssue(owner, 'First selected', owner.todoColumnId, 2, 1024n);
    const second = await createIssue(owner, 'Second selected', owner.todoColumnId, 3, 2048n);
    const foreign = await createIssue(outsider, 'Foreign task', outsider.todoColumnId, 5, 1024n);
    const otherSprint = await sprints.create(owner.userId, owner.projectId, {
      name: 'Other Sprint',
      goal: '',
      startDate: '2026-10-29',
      endDate: '2026-11-11',
    });
    await sprints.addIssue(owner.userId, otherSprint.id, second.id);

    await expect(
      sprints.bulkAddIssues(owner.userId, sprint.id, [first.id, foreign.id])
    ).rejects.toBeInstanceOf(ResourceNotFoundError);
    expect(await prisma.issue.findUniqueOrThrow({ where: { id: first.id } })).toMatchObject({
      sprintId: null,
    });

    await expect(
      sprints.bulkAddIssues(owner.userId, sprint.id, [first.id, second.id])
    ).rejects.toBeInstanceOf(DomainConflictError);
    await expect(
      prisma.issue.findUniqueOrThrow({ where: { id: first.id } })
    ).resolves.toMatchObject({ sprintId: null });
    await expect(
      prisma.issue.findUniqueOrThrow({ where: { id: second.id } })
    ).resolves.toMatchObject({ sprintId: otherSprint.id });

    const third = await createIssue(owner, 'Third selected', owner.todoColumnId, 1, 3072n);
    const updated = await sprints.bulkAddIssues(owner.userId, sprint.id, [first.id, third.id]);
    expect(updated.issueCount).toBe(2);
    expect(
      await prisma.issue.count({
        where: { id: { in: [first.id, third.id] }, sprintId: sprint.id },
      })
    ).toBe(2);
  });

  it('rejects a cross-Project Sprint assignment at the database boundary', async () => {
    const first = await createFixture('database-project-integrity-a');
    const second = await createFixture('database-project-integrity-b');
    const sprint = await sprints.create(first.userId, first.projectId, {
      name: 'Project A Sprint',
      goal: '',
      startDate: '2026-10-01',
      endDate: '2026-10-14',
    });
    const foreignIssue = await createIssue(second, 'Project B task', second.todoColumnId, 3, 1024n);

    await expect(
      prisma.issue.update({ where: { id: foreignIssue.id }, data: { sprintId: sprint.id } })
    ).rejects.toMatchObject({ code: 'P2003' });
  });

  it('serializes Sprint start against a concurrent switch to Kanban', async () => {
    const owner = await createFixture('start-mode-race');
    const sprint = await sprints.create(owner.userId, owner.projectId, {
      name: 'Race Sprint',
      goal: '',
      startDate: '2026-11-01',
      endDate: '2026-11-14',
    });
    const task = await createIssue(owner, 'Race task', owner.todoColumnId, 2, 1024n);
    await sprints.addIssue(owner.userId, sprint.id, task.id);

    const outcomes = await Promise.allSettled([
      sprints.start(owner.userId, sprint.id, sprint.version),
      projects.updateMode(owner.userId, owner.projectId, {
        mode: ProjectModeDto.kanban,
        version: owner.projectVersion,
      }),
    ]);
    expect(outcomes.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);

    const [storedProject, storedSprint] = await Promise.all([
      prisma.project.findUniqueOrThrow({ where: { id: owner.projectId } }),
      prisma.sprint.findUniqueOrThrow({ where: { id: sprint.id } }),
    ]);
    expect(storedProject.mode === 'kanban' && storedSprint.status === 'active').toBe(false);
  });

  it('serializes completion against assignment so no task is orphaned in a completed Sprint', async () => {
    const owner = await createFixture('complete-add-race');
    const sprint = await sprints.create(owner.userId, owner.projectId, {
      name: 'Completion Race Sprint',
      goal: '',
      startDate: '2026-12-01',
      endDate: '2026-12-14',
    });
    const initial = await createIssue(owner, 'Initial task', owner.todoColumnId, 1, 1024n);
    const late = await createIssue(owner, 'Concurrent task', owner.todoColumnId, 2, 2048n);
    await sprints.addIssue(owner.userId, sprint.id, initial.id);
    const active = await sprints.start(owner.userId, sprint.id, sprint.version);

    const [completion, assignment] = await Promise.allSettled([
      sprints.complete(owner.userId, sprint.id, {
        version: active.version,
        incompleteDestination: 'backlog',
      }),
      sprints.addIssue(owner.userId, sprint.id, late.id),
    ]);
    expect(completion.status).toBe('fulfilled');
    if (assignment.status === 'rejected') {
      expect(assignment.reason).toBeInstanceOf(DomainValidationError);
    }

    expect(await prisma.sprint.findUniqueOrThrow({ where: { id: sprint.id } })).toMatchObject({
      status: 'completed',
    });
    expect(await prisma.issue.findUniqueOrThrow({ where: { id: late.id } })).toMatchObject({
      sprintId: null,
    });
  });

  it('serializes completion against moving a task to Done', async () => {
    const owner = await createFixture('complete-move-race');
    const sprint = await sprints.create(owner.userId, owner.projectId, {
      name: 'Completion Move Race',
      goal: '',
      startDate: '2027-01-01',
      endDate: '2027-01-14',
    });
    const task = await createIssue(owner, 'Moving task', owner.todoColumnId, 5, 1024n);
    await sprints.addIssue(owner.userId, sprint.id, task.id);
    const active = await sprints.start(owner.userId, sprint.id, sprint.version);
    const assigned = await prisma.issue.findUniqueOrThrow({ where: { id: task.id } });

    const [completion, move] = await Promise.allSettled([
      sprints.complete(owner.userId, sprint.id, {
        version: active.version,
        incompleteDestination: 'backlog',
      }),
      issues.move(owner.userId, task.id, {
        version: assigned.version,
        sprintId: sprint.id,
        targetColumnId: owner.doneColumnId,
      }),
    ]);
    expect(completion.status).toBe('fulfilled');

    const [storedSprint, storedTask] = await Promise.all([
      prisma.sprint.findUniqueOrThrow({ where: { id: sprint.id } }),
      prisma.issue.findUniqueOrThrow({ where: { id: task.id } }),
    ]);
    if (move.status === 'fulfilled') {
      expect(storedSprint).toMatchObject({ completedPoints: 5, incompletePoints: 0 });
      expect(storedTask).toMatchObject({ sprintId: sprint.id, columnId: owner.doneColumnId });
    } else {
      expect(storedSprint).toMatchObject({ completedPoints: 0, incompletePoints: 5 });
      expect(storedTask.sprintId).toBeNull();
    }
  });

  it('rebalances ranks safely when atomic Sprint creation targets a closed rank gap', async () => {
    const owner = await createFixture('atomic-rank-rebalance');
    const sprint = await sprints.create(owner.userId, owner.projectId, {
      name: 'Rank Sprint',
      goal: '',
      startDate: '2027-02-01',
      endDate: '2027-02-14',
    });
    const first = await createIssue(owner, 'First', owner.todoColumnId, null, 1n);
    const second = await createIssue(owner, 'Second', owner.todoColumnId, null, 2n);

    const inserted = await sprints.createIssue(owner.userId, sprint.id, {
      title: 'Between',
      columnId: owner.todoColumnId,
      afterIssueId: first.id,
      beforeIssueId: second.id,
    });
    const ordered = await prisma.issue.findMany({
      where: { columnId: owner.todoColumnId, archivedAt: null },
      orderBy: { rank: 'asc' },
      select: { id: true },
    });
    expect(ordered.map(({ id }) => id)).toEqual([first.id, inserted.id, second.id]);
  });

  it('lists completed Sprint history by completion time, newest first', async () => {
    const owner = await createFixture('history-order');
    const older = await prisma.sprint.create({
      data: {
        projectId: owner.projectId,
        name: 'Older completion',
        status: 'completed',
        startDate: new Date('2026-08-01'),
        endDate: new Date('2026-08-14'),
        completedAt: new Date('2026-08-20T00:00:00.000Z'),
      },
    });
    const newer = await prisma.sprint.create({
      data: {
        projectId: owner.projectId,
        name: 'Newer completion',
        status: 'completed',
        startDate: new Date('2026-07-01'),
        endDate: new Date('2026-07-14'),
        completedAt: new Date('2026-08-21T00:00:00.000Z'),
      },
    });

    const history = (await sprints.list(owner.userId, owner.projectId)).sprints.filter(
      ({ status }) => status === 'completed'
    );
    expect(history.map(({ id }) => id)).toEqual([newer.id, older.id]);
  });

  it('enforces one active Sprint and prevents switching to Kanban while it is active', async () => {
    const owner = await createFixture('active-guard');
    const first = await sprints.create(owner.userId, owner.projectId, {
      name: 'Active Sprint',
      goal: '',
      startDate: '2026-09-01',
      endDate: '2026-09-14',
    });
    const second = await sprints.create(owner.userId, owner.projectId, {
      name: 'Blocked Sprint',
      goal: '',
      startDate: '2026-09-15',
      endDate: '2026-09-28',
    });
    const task = await createIssue(owner, 'Task', owner.todoColumnId, 3, 1024n);
    const otherTask = await createIssue(owner, 'Other task', owner.todoColumnId, 5, 2048n);
    await sprints.addIssue(owner.userId, first.id, task.id);
    await sprints.addIssue(owner.userId, second.id, otherTask.id);
    const started = await sprints.start(owner.userId, first.id, first.version);

    await expect(sprints.start(owner.userId, second.id, second.version)).rejects.toBeInstanceOf(
      DomainConflictError
    );
    await expect(sprints.addIssue(owner.userId, second.id, task.id)).rejects.toThrow(
      'Move the task to backlog before assigning another Sprint'
    );
    await expect(
      projects.updateMode(owner.userId, owner.projectId, {
        mode: ProjectModeDto.kanban,
        version: owner.projectVersion,
      })
    ).rejects.toBeInstanceOf(DomainConflictError);

    await sprints.complete(owner.userId, first.id, {
      version: started.version,
      incompleteDestination: 'backlog',
    });
    expect((await prisma.issue.findUniqueOrThrow({ where: { id: task.id } })).sprintId).toBeNull();
    await expect(
      projects.updateMode(owner.userId, owner.projectId, {
        mode: ProjectModeDto.kanban,
        version: owner.projectVersion,
      })
    ).resolves.toMatchObject({ mode: 'kanban', version: owner.projectVersion + 1 });
  });

  it('switches a Kanban project to Scrum with optimistic versioning', async () => {
    const owner = await createFixture('mode-switch', 'kanban');
    const updated = await projects.updateMode(owner.userId, owner.projectId, {
      mode: ProjectModeDto.scrum,
      version: owner.projectVersion,
    });
    expect(updated).toMatchObject({ mode: 'scrum', version: owner.projectVersion + 1 });

    await expect(
      projects.updateMode(owner.userId, owner.projectId, {
        mode: ProjectModeDto.kanban,
        version: owner.projectVersion,
      })
    ).rejects.toBeInstanceOf(VersionConflictError);
  });

  async function createFixture(label: string, mode: 'kanban' | 'scrum' = 'scrum') {
    const user = await prisma.user.create({
      data: { displayName: `Integration Sprint ${label}` },
    });
    cleanupUserIds.push(user.id);
    const workspace = await prisma.workspace.create({
      data: { ownerId: user.id, name: `Sprint workspace ${label}` },
    });
    const project = await prisma.project.create({
      data: { workspaceId: workspace.id, name: `Sprint project ${label}`, mode },
    });
    const [todo, done] = await Promise.all([
      prisma.boardColumn.create({
        data: { projectId: project.id, name: 'To do', category: 'todo', rank: 1024n },
      }),
      prisma.boardColumn.create({
        data: { projectId: project.id, name: 'Done', category: 'done', rank: 2048n },
      }),
    ]);
    return {
      userId: user.id,
      projectId: project.id,
      projectVersion: project.version,
      todoColumnId: todo.id,
      doneColumnId: done.id,
    };
  }

  function createIssue(
    owner: Awaited<ReturnType<typeof createFixture>>,
    title: string,
    columnId: string,
    storyPoints: number | null,
    rank: bigint
  ) {
    return prisma.issue.create({
      data: { projectId: owner.projectId, columnId, title, storyPoints, rank },
    });
  }

  async function cleanupFixtures() {
    const users = await prisma.user.findMany({
      where: { displayName: { startsWith: 'Integration Sprint ' } },
      select: { id: true },
    });
    const userIds = users.map(({ id }) => id);
    if (!userIds.length) return;
    await prisma.workspace.deleteMany({ where: { ownerId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }
});
