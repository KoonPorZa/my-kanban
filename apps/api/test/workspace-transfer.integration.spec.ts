import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PrismaService } from '../src/database/prisma.service';
import { PrismaProjectsRepository } from '../src/projects/prisma-projects.repository';
import {
  DomainConflictError,
  DomainValidationError,
  ResourceNotFoundError,
  VersionConflictError,
} from '../src/common/domain/domain-errors';
import { WorkspaceTransferService } from '../src/workspace-transfer/workspace-transfer.service';

const FIXTURE_NAME = 'Workspace transfer integration';

describe('Workspace transfer persistence integration', () => {
  let prisma: PrismaService;
  let transfer: WorkspaceTransferService;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.onModuleInit();
    await cleanup();
    transfer = new WorkspaceTransferService(prisma);
  });

  afterAll(async () => {
    await cleanup();
    await prisma.onModuleDestroy();
  });

  it('roundtrips a replace export including retention and checklist data', async () => {
    const fixture = await createFixture('replace');
    const exported = await transfer.export(fixture.userId);
    expect(exported.projects[0]).toMatchObject({ doneRetentionDays: 14 });
    expect(exported.projects[0]?.issues[0]?.checklist[0]).toMatchObject({
      title: 'Verify recovery',
      rank: '1024',
    });

    await prisma.project.update({
      where: { id: fixture.projectId },
      data: { name: 'Mutated project', doneRetentionDays: 30 },
    });
    await prisma.issue.create({
      data: {
        projectId: fixture.projectId,
        columnId: fixture.columnId,
        title: 'Not in export',
        rank: 2048n,
      },
    });

    await transfer.import(fixture.userId, exported, 'replace');
    const restored = await transfer.export(fixture.userId);
    expect({ ...restored, exportedAt: exported.exportedAt }).toEqual(exported);
  });

  it('previews validated impact without mutating workspace data', async () => {
    const fixture = await createFixture('preview');
    const exported = await transfer.export(fixture.userId);
    const before = await transfer.export(fixture.userId);

    await expect(transfer.previewImport(fixture.userId, exported, 'replace')).resolves.toEqual({
      mode: 'replace',
      schemaVersion: 1,
      exportedAt: exported.exportedAt,
      workspaceName: exported.workspace.name,
      counts: { projects: 1, columns: 2, sprints: 0, issues: 1, checklistItems: 1 },
      impact: { newProjects: 0, matchingProjects: 1, projectsToArchive: 0 },
    });

    const after = await transfer.export(fixture.userId);
    expect({ ...after, exportedAt: before.exportedAt }).toEqual(before);
  });

  it('rejects an invalid replace before opening a transaction or mutating data', async () => {
    const fixture = await createFixture('invalid-replace');
    const before = await transfer.export(fixture.userId);
    const invalid = structuredClone(before) as unknown as {
      workspace: { activeProjectId: string | null };
    };
    invalid.workspace.activeProjectId = null;

    await expect(
      transfer.import(fixture.userId, invalid as never, 'replace')
    ).rejects.toBeInstanceOf(DomainValidationError);

    const after = await transfer.export(fixture.userId);
    expect({ ...after, exportedAt: before.exportedAt }).toEqual(before);
  });

  it('serializes a concurrent Project create against replace import at the Workspace lock', async () => {
    const fixture = await createFixture('create-replace-race');
    const exported = await transfer.export(fixture.userId);
    const projects = new PrismaProjectsRepository(prisma);
    let releaseLock!: () => void;
    let reportLocked!: () => void;
    const release = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });
    const locked = new Promise<void>((resolve) => {
      reportLocked = resolve;
    });
    const blocker = prisma.$transaction(
      async (transaction) => {
        await transaction.$queryRaw`
          SELECT id::text FROM workspaces WHERE id = ${fixture.workspaceId}::uuid FOR UPDATE
        `;
        reportLocked();
        await release;
      },
      { timeout: 10_000 }
    );
    await locked;

    const creating = projects.create(fixture.userId, { name: 'Concurrent create' });
    const replacing = transfer.import(fixture.userId, exported, 'replace');
    await new Promise((resolve) => setTimeout(resolve, 50));
    releaseLock();
    await blocker;
    await Promise.all([creating, replacing]);

    const workspace = await prisma.workspace.findUniqueOrThrow({
      where: { id: fixture.workspaceId },
      select: { activeProjectId: true },
    });
    expect(workspace.activeProjectId).not.toBeNull();
    await expect(
      prisma.project.findUniqueOrThrow({ where: { id: workspace.activeProjectId! } })
    ).resolves.toMatchObject({ archivedAt: null });
  });

  it('preserves absent and newer destination rows while applying newer imported rows', async () => {
    const fixture = await createFixture('merge');
    const exported = await transfer.export(fixture.userId);
    const originalIssue = exported.projects[0].issues[0];

    const preserved = await prisma.issue.create({
      data: {
        projectId: fixture.projectId,
        columnId: fixture.columnId,
        title: 'Destination only',
        rank: 2048n,
      },
    });
    await prisma.issue.update({
      where: { id: fixture.issueId },
      data: { title: 'Destination is newer', updatedAt: new Date('2030-01-01T00:00:00.000Z') },
    });

    await transfer.import(fixture.userId, exported, 'merge');
    await expect(
      prisma.issue.findUniqueOrThrow({ where: { id: preserved.id } })
    ).resolves.toMatchObject({
      title: 'Destination only',
    });
    await expect(
      prisma.issue.findUniqueOrThrow({ where: { id: fixture.issueId } })
    ).resolves.toMatchObject({ title: 'Destination is newer' });

    const newerImport = structuredClone(exported);
    newerImport.projects[0].name = 'Imported newer project';
    newerImport.projects[0].doneRetentionDays = 7;
    newerImport.projects[0].updatedAt = '2031-01-01T00:00:00.000Z';
    newerImport.projects[0].issues[0] = {
      ...originalIssue,
      title: 'Imported is newer',
      updatedAt: '2031-01-01T00:00:00.000Z',
    };
    await transfer.import(fixture.userId, newerImport, 'merge');

    await expect(
      prisma.project.findUniqueOrThrow({ where: { id: fixture.projectId } })
    ).resolves.toMatchObject({ name: 'Imported newer project', doneRetentionDays: 7 });
    await expect(
      prisma.issue.findUniqueOrThrow({ where: { id: fixture.issueId } })
    ).resolves.toMatchObject({ title: 'Imported is newer' });
    await expect(prisma.issue.findUnique({ where: { id: preserved.id } })).resolves.not.toBeNull();
  });

  it('rolls back every write when a valid import contains a re-parent conflict', async () => {
    const fixture = await createFixture('atomic');
    const exported = await transfer.export(fixture.userId);
    const foreign = await createFixture('foreign');
    const before = await prisma.project.findUniqueOrThrow({ where: { id: fixture.projectId } });

    exported.projects[0].name = 'Must roll back';
    exported.projects[0].updatedAt = '2032-01-01T00:00:00.000Z';
    exported.projects[0].columns[0].id = foreign.columnId;
    exported.projects[0].issues[0].columnId = foreign.columnId;

    await expect(transfer.previewImport(fixture.userId, exported, 'merge')).rejects.toBeInstanceOf(
      DomainConflictError
    );

    await expect(transfer.import(fixture.userId, exported, 'merge')).rejects.toBeInstanceOf(
      DomainConflictError
    );
    await expect(
      prisma.project.findUniqueOrThrow({ where: { id: fixture.projectId } })
    ).resolves.toMatchObject({ name: before.name, updatedAt: before.updatedAt });
  });

  it('never exports or replaces authentication and MCP secret entities', async () => {
    const fixture = await createFixture('secrets');
    const token = await prisma.mcpAccessToken.create({
      data: {
        projectId: fixture.projectId,
        createdById: fixture.userId,
        label: 'Secret token',
        clientType: 'codex',
        tokenPrefix: `mk_${randomUUID().slice(0, 16)}`,
        tokenHash: randomUUID().replaceAll('-', ''),
        expiresAt: new Date('2035-01-01T00:00:00.000Z'),
      },
    });

    const exported = await transfer.export(fixture.userId);
    const serialized = JSON.stringify(exported);
    expect(serialized).not.toContain(token.tokenPrefix);
    expect(serialized).not.toContain(token.tokenHash);
    expect(serialized).not.toContain('authIdentities');
    expect(serialized).not.toContain('http_sessions');

    await transfer.import(fixture.userId, exported, 'replace');
    await expect(
      prisma.mcpAccessToken.findUnique({ where: { id: token.id } })
    ).resolves.toMatchObject({
      tokenHash: token.tokenHash,
      revokedAt: null,
    });
  });

  it('permanently deletes only an archived owner task with its disclosed checklist aggregate', async () => {
    const fixture = await createFixture('delete-task');
    const outsider = await createFixture('delete-task-outsider');

    await expect(
      transfer.permanentlyDeleteIssue(fixture.userId, fixture.issueId, 1)
    ).rejects.toBeInstanceOf(DomainConflictError);
    const archived = await prisma.issue.update({
      where: { id: fixture.issueId },
      data: { archivedAt: new Date(), version: { increment: 1 } },
    });
    await expect(
      transfer.permanentlyDeleteIssue(outsider.userId, fixture.issueId, archived.version)
    ).rejects.toBeInstanceOf(ResourceNotFoundError);
    await expect(
      transfer.permanentlyDeleteIssue(fixture.userId, fixture.issueId, 1)
    ).rejects.toBeInstanceOf(VersionConflictError);

    await expect(
      transfer.permanentlyDeleteIssue(fixture.userId, fixture.issueId, archived.version)
    ).resolves.toMatchObject({ deleted: true, checklistCount: 1 });
    await expect(prisma.issue.findUnique({ where: { id: fixture.issueId } })).resolves.toBeNull();
  });

  it('moves disclosed assigned tasks to backlog before deleting a non-active Sprint', async () => {
    const fixture = await createFixture('delete-sprint');
    const active = await prisma.sprint.create({
      data: {
        projectId: fixture.projectId,
        name: 'Active Sprint',
        status: 'active',
        startDate: new Date('2026-09-01T00:00:00.000Z'),
        endDate: new Date('2026-09-14T00:00:00.000Z'),
      },
    });
    await expect(
      transfer.permanentlyDeleteSprint(fixture.userId, active.id, active.version)
    ).rejects.toBeInstanceOf(DomainConflictError);

    const completed = await prisma.sprint.create({
      data: {
        projectId: fixture.projectId,
        name: 'Completed Sprint',
        status: 'completed',
        startDate: new Date('2026-08-01T00:00:00.000Z'),
        endDate: new Date('2026-08-14T00:00:00.000Z'),
        completedAt: new Date('2026-08-14T12:00:00.000Z'),
      },
    });
    await prisma.issue.update({
      where: { id: fixture.issueId },
      data: { sprintId: completed.id },
    });

    await expect(
      transfer.permanentlyDeleteSprint(fixture.userId, completed.id, completed.version)
    ).resolves.toMatchObject({ deleted: true, movedIssueCount: 1 });
    await expect(
      prisma.issue.findUniqueOrThrow({ where: { id: fixture.issueId } })
    ).resolves.toMatchObject({ sprintId: null, version: 2 });
  });

  it('deletes an archived Project only after reporting every child aggregate', async () => {
    const fixture = await createFixture('delete-project');
    await prisma.issue.update({
      where: { id: fixture.issueId },
      data: { archivedAt: new Date(), version: { increment: 1 } },
    });
    const archived = await prisma.project.update({
      where: { id: fixture.projectId },
      data: { archivedAt: new Date(), version: { increment: 1 } },
    });
    const token = await prisma.mcpAccessToken.create({
      data: {
        projectId: fixture.projectId,
        createdById: fixture.userId,
        label: 'Delete with Project',
        clientType: 'codex',
        tokenPrefix: `mk_${randomUUID().slice(0, 16)}`,
        tokenHash: randomUUID().replaceAll('-', ''),
        expiresAt: new Date('2035-01-01T00:00:00.000Z'),
      },
    });
    const retainedAudit = await prisma.mcpAuditEvent.create({
      data: {
        projectId: fixture.projectId,
        tokenId: token.id,
        issueId: fixture.issueId,
        toolName: 'archive_task',
        requestId: randomUUID(),
        outcome: 'success',
      },
    });
    const candidates = await transfer.listDeletionCandidates(fixture.userId);
    expect(candidates.issues).not.toContainEqual(expect.objectContaining({ id: fixture.issueId }));
    expect(candidates.projects).toContainEqual(
      expect.objectContaining({
        id: fixture.projectId,
        columnCount: 2,
        issueCount: 1,
        sprintCount: 0,
        mcpTokenCount: 1,
        mcpAuditEventCount: 1,
      })
    );

    await expect(
      transfer.permanentlyDeleteProject(fixture.userId, fixture.projectId, archived.version)
    ).rejects.toThrow('90-day retention period');
    await expect(
      prisma.project.findUniqueOrThrow({ where: { id: fixture.projectId } })
    ).resolves.toMatchObject({ archivedAt: archived.archivedAt });

    await prisma.mcpAuditEvent.update({
      where: { id: retainedAudit.id },
      data: { createdAt: new Date('2020-01-01T00:00:00.000Z') },
    });

    await expect(
      transfer.permanentlyDeleteProject(fixture.userId, fixture.projectId, archived.version)
    ).resolves.toMatchObject({
      deleted: true,
      columnCount: 2,
      issueCount: 1,
      sprintCount: 0,
      mcpTokenCount: 1,
      mcpAuditEventCount: 1,
    });
    await expect(
      prisma.project.findUnique({ where: { id: fixture.projectId } })
    ).resolves.toBeNull();
    await expect(
      prisma.workspace.findUniqueOrThrow({ where: { id: fixture.workspaceId } })
    ).resolves.toMatchObject({ activeProjectId: null });
  });

  async function createFixture(suffix: string) {
    const user = await prisma.user.create({ data: { displayName: `${FIXTURE_NAME} ${suffix}` } });
    const workspace = await prisma.workspace.create({
      data: { ownerId: user.id, name: `Recovery ${suffix}` },
    });
    const project = await prisma.project.create({
      data: {
        workspaceId: workspace.id,
        name: `Project ${suffix}`,
        mode: 'scrum',
        doneRetentionDays: 14,
      },
    });
    const column = await prisma.boardColumn.create({
      data: { projectId: project.id, name: 'To do', rank: 1024n },
    });
    await prisma.boardColumn.create({
      data: { projectId: project.id, name: 'Done', category: 'done', rank: 2048n },
    });
    const issue = await prisma.issue.create({
      data: {
        projectId: project.id,
        columnId: column.id,
        title: 'Portable task',
        rank: 1024n,
        checklist: {
          create: { title: 'Verify recovery', rank: 1024n },
        },
      },
    });
    await prisma.workspace.update({
      where: { id: workspace.id },
      data: { activeProjectId: project.id },
    });
    return {
      userId: user.id,
      workspaceId: workspace.id,
      projectId: project.id,
      columnId: column.id,
      issueId: issue.id,
    };
  }

  async function cleanup() {
    const users = await prisma.user.findMany({
      where: { displayName: { startsWith: FIXTURE_NAME } },
      select: { id: true },
    });
    const userIds = users.map(({ id }) => id);
    if (!userIds.length) return;
    await prisma.mcpAuditEvent.deleteMany({ where: { token: { createdById: { in: userIds } } } });
    await prisma.mcpAccessToken.deleteMany({ where: { createdById: { in: userIds } } });
    await prisma.workspace.deleteMany({ where: { ownerId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }
});
