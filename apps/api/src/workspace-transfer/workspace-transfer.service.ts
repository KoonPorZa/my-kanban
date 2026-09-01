import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../database/prisma.service';
import { lockProjectTransaction } from '../database/project-transaction-lock';
import {
  lockWorkspaceTransaction,
  lockOwnerWorkspaceTransaction,
} from '../database/workspace-transaction-lock';
import {
  DomainConflictError,
  DomainValidationError,
  ResourceNotFoundError,
  VersionConflictError,
} from '../common/domain/domain-errors';
import { workspaceExportSchema, type WorkspaceExport } from './workspace-transfer.schema';

export type WorkspaceImportMode = 'replace' | 'merge';

const MCP_AUDIT_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

@Injectable()
export class WorkspaceTransferService {
  constructor(private readonly prisma: PrismaService) {}

  async export(ownerId: string): Promise<WorkspaceExport> {
    const workspace = await this.prisma.workspace.findFirst({
      where: { ownerId },
      orderBy: { createdAt: 'asc' },
      include: {
        projects: {
          orderBy: { createdAt: 'asc' },
          include: {
            columns: { orderBy: { rank: 'asc' } },
            sprints: { orderBy: { createdAt: 'asc' } },
            issues: {
              orderBy: [{ columnId: 'asc' }, { rank: 'asc' }],
              include: { checklist: { orderBy: { rank: 'asc' } } },
            },
          },
        },
      },
    });
    if (!workspace) throw new ResourceNotFoundError('Workspace');
    if (!workspace.activeProjectId) {
      throw new DomainValidationError('Workspace must have an active Project before export');
    }

    return {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      workspace: {
        name: workspace.name,
        activeProjectId: workspace.activeProjectId,
        version: workspace.version,
        createdAt: workspace.createdAt.toISOString(),
        updatedAt: workspace.updatedAt.toISOString(),
      },
      projects: workspace.projects.map((project) => ({
        id: project.id,
        name: project.name,
        color: project.color,
        mode: project.mode,
        doneRetentionDays: project.doneRetentionDays,
        version: project.version,
        archivedAt: project.archivedAt?.toISOString() ?? null,
        createdAt: project.createdAt.toISOString(),
        updatedAt: project.updatedAt.toISOString(),
        columns: project.columns.map((column) => ({
          id: column.id,
          name: column.name,
          category: column.category,
          rank: column.rank.toString(),
          wipLimit: column.wipLimit,
          version: column.version,
          archivedAt: column.archivedAt?.toISOString() ?? null,
          createdAt: column.createdAt.toISOString(),
          updatedAt: column.updatedAt.toISOString(),
        })),
        sprints: project.sprints.map((sprint) => ({
          id: sprint.id,
          name: sprint.name,
          goal: sprint.goal,
          status: sprint.status,
          startDate: sprint.startDate.toISOString().slice(0, 10),
          endDate: sprint.endDate.toISOString().slice(0, 10),
          plannedPoints: sprint.plannedPoints,
          plannedIssueCount: sprint.plannedIssueCount,
          completedPoints: sprint.completedPoints,
          completedIssueCount: sprint.completedIssueCount,
          incompletePoints: sprint.incompletePoints,
          incompleteIssueCount: sprint.incompleteIssueCount,
          completedAt: sprint.completedAt?.toISOString() ?? null,
          version: sprint.version,
          createdAt: sprint.createdAt.toISOString(),
          updatedAt: sprint.updatedAt.toISOString(),
        })),
        issues: project.issues.map((issue) => ({
          id: issue.id,
          sprintId: issue.sprintId,
          columnId: issue.columnId,
          title: issue.title,
          description: issue.description,
          type: issue.type,
          priority: issue.priority,
          labels: issue.labels,
          storyPoints: issue.storyPoints,
          rank: issue.rank.toString(),
          version: issue.version,
          dueDate: issue.dueDate?.toISOString() ?? null,
          isBlocked: issue.isBlocked,
          blockedReason: issue.blockedReason,
          archivedAt: issue.archivedAt?.toISOString() ?? null,
          completedAt: issue.completedAt?.toISOString() ?? null,
          checklist: issue.checklist.map((item) => ({
            id: item.id,
            title: item.title,
            isCompleted: item.isCompleted,
            rank: item.rank.toString(),
            createdAt: item.createdAt.toISOString(),
            updatedAt: item.updatedAt.toISOString(),
          })),
          createdAt: issue.createdAt.toISOString(),
          updatedAt: issue.updatedAt.toISOString(),
        })),
      })),
    };
  }

  parse(input: unknown): WorkspaceExport {
    const parsed = workspaceExportSchema.safeParse(input);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const location = issue?.path.length ? ` at ${issue.path.join('.')}` : '';
      throw new DomainValidationError(`Invalid workspace export${location}: ${issue?.message}`);
    }
    return parsed.data;
  }

  async previewImport(ownerId: string, data: WorkspaceExport, mode: WorkspaceImportMode) {
    this.parse(data);
    const workspace = await this.prisma.workspace.findFirst({
      where: { ownerId },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    if (!workspace) throw new ResourceNotFoundError('Workspace');

    await this.assertImportOwnership(this.prisma, workspace.id, data);

    const importedProjectIds = data.projects.map((project) => project.id);
    const [matchingProjects, projectsToArchive] = await Promise.all([
      this.prisma.project.count({
        where: { workspaceId: workspace.id, id: { in: importedProjectIds } },
      }),
      mode === 'replace'
        ? this.prisma.project.count({
            where: {
              workspaceId: workspace.id,
              archivedAt: null,
              id: { notIn: importedProjectIds },
            },
          })
        : Promise.resolve(0),
    ]);

    return {
      mode,
      schemaVersion: data.schemaVersion,
      exportedAt: data.exportedAt,
      workspaceName: data.workspace.name,
      counts: importEntityCounts(data),
      impact: {
        newProjects: data.projects.length - matchingProjects,
        matchingProjects,
        projectsToArchive,
      },
    };
  }

  async import(ownerId: string, data: WorkspaceExport, mode: WorkspaceImportMode) {
    this.parse(data);
    return this.prisma.$transaction(
      async (transaction) => {
        const workspaceId = await lockOwnerWorkspaceTransaction(transaction, ownerId);
        if (!workspaceId) throw new ResourceNotFoundError('Workspace');
        const workspace = await transaction.workspace.findUnique({
          where: { id: workspaceId },
          select: { id: true, activeProjectId: true, updatedAt: true },
        });
        if (!workspace) throw new ResourceNotFoundError('Workspace');

        const importedProjectIds = data.projects.map((project) => project.id);
        const currentProjects = await transaction.project.findMany({
          where: { workspaceId: workspace.id },
          select: { id: true },
        });
        const projectIdsToLock = [
          ...new Set([...currentProjects.map(({ id }) => id), ...importedProjectIds]),
        ].sort();
        for (const projectId of projectIdsToLock) {
          await lockProjectTransaction(transaction, projectId);
        }
        await this.assertImportOwnership(transaction, workspace.id, data);

        if (mode === 'replace') {
          const currentIds = currentProjects.map((project) => project.id);
          await transaction.issue.deleteMany({ where: { projectId: { in: currentIds } } });
          await transaction.sprint.deleteMany({ where: { projectId: { in: currentIds } } });
          await transaction.boardColumn.deleteMany({ where: { projectId: { in: currentIds } } });
          await transaction.project.updateMany({
            where: { workspaceId: workspace.id },
            data: { archivedAt: new Date() },
          });
        }

        for (const project of data.projects) {
          await this.syncProject(transaction, workspace.id, project, mode);
        }

        if (mode === 'replace' || isNewer(data.workspace.updatedAt, workspace.updatedAt)) {
          await transaction.workspace.update({
            where: { id: workspace.id },
            data: {
              name: data.workspace.name,
              activeProjectId:
                mode === 'replace'
                  ? data.workspace.activeProjectId
                  : (data.workspace.activeProjectId ?? workspace.activeProjectId),
              version: data.workspace.version,
              updatedAt: new Date(data.workspace.updatedAt),
            },
          });
        }

        return {
          mode,
          schemaVersion: data.schemaVersion,
          projectCount: data.projects.length,
        };
      },
      { timeout: 30_000 }
    );
  }

  private async assertImportOwnership(
    client: Prisma.TransactionClient,
    workspaceId: string,
    data: WorkspaceExport
  ) {
    const expectedColumns = new Map(
      data.projects.flatMap((project) => project.columns.map((column) => [column.id, project.id]))
    );
    const expectedSprints = new Map(
      data.projects.flatMap((project) => project.sprints.map((sprint) => [sprint.id, project.id]))
    );
    const expectedIssues = new Map(
      data.projects.flatMap((project) => project.issues.map((issue) => [issue.id, project.id]))
    );
    const expectedChecklistItems = new Map(
      data.projects.flatMap((project) =>
        project.issues.flatMap((issue) => issue.checklist.map((item) => [item.id, issue.id]))
      )
    );
    const [projects, columns, sprints, issues, checklistItems] = await Promise.all([
      client.project.findMany({
        where: { id: { in: data.projects.map((project) => project.id) } },
        select: { id: true, workspaceId: true },
      }),
      client.boardColumn.findMany({
        where: { id: { in: [...expectedColumns.keys()] } },
        select: { id: true, projectId: true },
      }),
      client.sprint.findMany({
        where: { id: { in: [...expectedSprints.keys()] } },
        select: { id: true, projectId: true },
      }),
      client.issue.findMany({
        where: { id: { in: [...expectedIssues.keys()] } },
        select: { id: true, projectId: true },
      }),
      client.checklistItem.findMany({
        where: { id: { in: [...expectedChecklistItems.keys()] } },
        select: { id: true, issueId: true },
      }),
    ]);

    if (projects.some((project) => project.workspaceId !== workspaceId)) {
      throw new DomainConflictError('Import contains a Project owned by another workspace');
    }
    if (columns.some((column) => expectedColumns.get(column.id) !== column.projectId)) {
      throw reparentConflict('Column');
    }
    if (sprints.some((sprint) => expectedSprints.get(sprint.id) !== sprint.projectId)) {
      throw reparentConflict('Sprint');
    }
    if (issues.some((issue) => expectedIssues.get(issue.id) !== issue.projectId)) {
      throw reparentConflict('Task');
    }
    if (checklistItems.some((item) => expectedChecklistItems.get(item.id) !== item.issueId)) {
      throw reparentConflict('Checklist item');
    }
  }

  async listDeletionCandidates(ownerId: string) {
    const workspace = await this.prisma.workspace.findFirst({
      where: { ownerId },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    if (!workspace) throw new ResourceNotFoundError('Workspace');

    const [projects, sprints, issues] = await Promise.all([
      this.prisma.project.findMany({
        where: { workspaceId: workspace.id, archivedAt: { not: null } },
        orderBy: { archivedAt: 'desc' },
        select: {
          id: true,
          name: true,
          version: true,
          archivedAt: true,
          _count: {
            select: {
              columns: true,
              issues: true,
              sprints: true,
              mcpTokens: true,
              auditEvents: true,
            },
          },
        },
      }),
      this.prisma.sprint.findMany({
        where: { project: { workspaceId: workspace.id }, status: { not: 'active' } },
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          name: true,
          status: true,
          version: true,
          project: { select: { name: true } },
          _count: { select: { issues: true } },
        },
      }),
      this.prisma.issue.findMany({
        where: {
          project: { workspaceId: workspace.id, archivedAt: null },
          archivedAt: { not: null },
        },
        orderBy: { archivedAt: 'desc' },
        select: {
          id: true,
          title: true,
          version: true,
          archivedAt: true,
          project: { select: { name: true } },
          _count: { select: { checklist: true } },
        },
      }),
    ]);

    return {
      projects: projects.map(({ _count, ...project }) => ({
        ...project,
        archivedAt: project.archivedAt!.toISOString(),
        columnCount: _count.columns,
        issueCount: _count.issues,
        sprintCount: _count.sprints,
        mcpTokenCount: _count.mcpTokens,
        mcpAuditEventCount: _count.auditEvents,
      })),
      sprints: sprints.map(({ _count, project, ...sprint }) => ({
        ...sprint,
        projectName: project.name,
        issueCount: _count.issues,
      })),
      issues: issues.map(({ _count, project, ...issue }) => ({
        ...issue,
        archivedAt: issue.archivedAt!.toISOString(),
        projectName: project.name,
        checklistCount: _count.checklist,
      })),
    };
  }

  async permanentlyDeleteProject(ownerId: string, projectId: string, version: number) {
    return this.prisma.$transaction(async (transaction) => {
      const owned = await transaction.project.findFirst({
        where: { id: projectId, workspace: { ownerId } },
        select: { id: true, workspaceId: true },
      });
      if (!owned) throw new ResourceNotFoundError('Project');
      await lockWorkspaceTransaction(transaction, owned.workspaceId);
      await lockProjectTransaction(transaction, owned.id);
      const project = await transaction.project.findFirst({
        where: { id: projectId, workspace: { ownerId } },
        select: {
          workspaceId: true,
          version: true,
          archivedAt: true,
          _count: {
            select: {
              columns: true,
              issues: true,
              sprints: true,
              mcpTokens: true,
              auditEvents: true,
            },
          },
        },
      });
      if (!project) throw new ResourceNotFoundError('Project');
      if (project.version !== version) throw new VersionConflictError('Project');
      if (!project.archivedAt)
        throw new DomainConflictError('Archive the Project before deleting it');
      const retainedAuditCount = await transaction.mcpAuditEvent.count({
        where: {
          projectId,
          createdAt: { gt: new Date(Date.now() - MCP_AUDIT_RETENTION_MS) },
        },
      });
      if (retainedAuditCount > 0) {
        throw new DomainConflictError(
          `This Project has ${retainedAuditCount} MCP audit event(s) still inside the 90-day retention period`
        );
      }
      if (project._count.mcpTokens > 0) {
        const tokens = await transaction.mcpAccessToken.findMany({
          where: { projectId },
          select: { id: true },
        });
        const tokenIds = tokens.map(({ id }) => id);
        await transaction.mcpAuditEvent.deleteMany({ where: { tokenId: { in: tokenIds } } });
        await transaction.mcpAccessToken.deleteMany({ where: { id: { in: tokenIds } } });
      }
      const deleted = await transaction.project.deleteMany({
        where: { id: projectId, version, archivedAt: { not: null } },
      });
      if (deleted.count !== 1) throw new VersionConflictError('Project');
      const workspace = await transaction.workspace.findUnique({
        where: { id: project.workspaceId },
        select: { activeProjectId: true },
      });
      if (workspace?.activeProjectId === projectId) {
        const fallback = await transaction.project.findFirst({
          where: { workspaceId: project.workspaceId, archivedAt: null },
          orderBy: { createdAt: 'asc' },
          select: { id: true },
        });
        await transaction.workspace.update({
          where: { id: project.workspaceId },
          data: { activeProjectId: fallback?.id ?? null, version: { increment: 1 } },
        });
      }
      return {
        id: projectId,
        deleted: true,
        columnCount: project._count.columns,
        issueCount: project._count.issues,
        sprintCount: project._count.sprints,
        mcpTokenCount: project._count.mcpTokens,
        mcpAuditEventCount: project._count.auditEvents,
      };
    });
  }

  async permanentlyDeleteSprint(ownerId: string, sprintId: string, version: number) {
    return this.prisma.$transaction(async (transaction) => {
      const owned = await transaction.sprint.findFirst({
        where: { id: sprintId, project: { workspace: { ownerId } } },
        select: { projectId: true },
      });
      if (!owned) throw new ResourceNotFoundError('Sprint');
      await lockProjectTransaction(transaction, owned.projectId);
      const sprint = await transaction.sprint.findFirst({
        where: { id: sprintId, project: { workspace: { ownerId } } },
        select: { version: true, status: true, _count: { select: { issues: true } } },
      });
      if (!sprint) throw new ResourceNotFoundError('Sprint');
      if (sprint.version !== version) throw new VersionConflictError('Sprint');
      if (sprint.status === 'active') {
        throw new DomainConflictError('Complete the active Sprint before deleting it');
      }
      await transaction.issue.updateMany({
        where: { sprintId },
        data: { sprintId: null, version: { increment: 1 } },
      });
      const deleted = await transaction.sprint.deleteMany({ where: { id: sprintId, version } });
      if (deleted.count !== 1) throw new VersionConflictError('Sprint');
      return { id: sprintId, deleted: true, movedIssueCount: sprint._count.issues };
    });
  }

  async permanentlyDeleteIssue(ownerId: string, issueId: string, version: number) {
    return this.prisma.$transaction(async (transaction) => {
      const owned = await transaction.issue.findFirst({
        where: { id: issueId, project: { workspace: { ownerId } } },
        select: { projectId: true },
      });
      if (!owned) throw new ResourceNotFoundError('Task');
      await lockProjectTransaction(transaction, owned.projectId);
      const issue = await transaction.issue.findFirst({
        where: { id: issueId, project: { workspace: { ownerId } } },
        select: { version: true, archivedAt: true, _count: { select: { checklist: true } } },
      });
      if (!issue) throw new ResourceNotFoundError('Task');
      if (issue.version !== version) throw new VersionConflictError('Task');
      if (!issue.archivedAt) throw new DomainConflictError('Archive the Task before deleting it');
      const deleted = await transaction.issue.deleteMany({
        where: { id: issueId, version, archivedAt: { not: null } },
      });
      if (deleted.count !== 1) throw new VersionConflictError('Task');
      return { id: issueId, deleted: true, checklistCount: issue._count.checklist };
    });
  }

  private async syncProject(
    transaction: Prisma.TransactionClient,
    workspaceId: string,
    project: WorkspaceExport['projects'][number],
    mode: WorkspaceImportMode
  ) {
    const existing = await transaction.project.findUnique({
      where: { id: project.id },
      select: { workspaceId: true, updatedAt: true },
    });
    if (existing && existing.workspaceId !== workspaceId) {
      throw new DomainConflictError('Import contains a Project owned by another workspace');
    }
    const projectData = {
      name: project.name,
      color: project.color,
      mode: project.mode,
      doneRetentionDays: project.doneRetentionDays,
      version: project.version,
      archivedAt: toDate(project.archivedAt),
      updatedAt: new Date(project.updatedAt),
    };
    if (!existing) {
      await transaction.project.create({
        data: {
          id: project.id,
          workspaceId,
          ...projectData,
          createdAt: new Date(project.createdAt),
        },
      });
    } else if (mode === 'replace' || isNewer(project.updatedAt, existing.updatedAt)) {
      await transaction.project.update({ where: { id: project.id }, data: projectData });
    }

    if (mode === 'replace') {
      await this.createProjectChildren(transaction, project);
      return;
    }

    for (const column of project.columns) {
      const current = await transaction.boardColumn.findUnique({
        where: { id: column.id },
        select: { projectId: true, updatedAt: true },
      });
      if (current && current.projectId !== project.id) throw reparentConflict('Column');
      if (!current) {
        await transaction.boardColumn.create({ data: columnCreateData(project.id, column) });
      } else if (isNewer(column.updatedAt, current.updatedAt)) {
        await transaction.boardColumn.update({
          where: { id: column.id },
          data: columnUpdateData(column),
        });
      }
    }

    for (const sprint of project.sprints) {
      const current = await transaction.sprint.findUnique({
        where: { id: sprint.id },
        select: { projectId: true, updatedAt: true },
      });
      if (current && current.projectId !== project.id) throw reparentConflict('Sprint');
      if (!current) {
        await transaction.sprint.create({ data: sprintCreateData(project.id, sprint) });
      } else if (isNewer(sprint.updatedAt, current.updatedAt)) {
        await transaction.sprint.update({
          where: { id: sprint.id },
          data: sprintUpdateData(sprint),
        });
      }
    }

    for (const issue of project.issues) {
      const current = await transaction.issue.findUnique({
        where: { id: issue.id },
        select: { projectId: true, updatedAt: true },
      });
      if (current && current.projectId !== project.id) throw reparentConflict('Task');
      if (!current) {
        await transaction.issue.create({ data: issueCreateData(project.id, issue) });
      } else if (isNewer(issue.updatedAt, current.updatedAt)) {
        await transaction.issue.update({
          where: { id: issue.id },
          data: issueUpdateData(issue),
        });
      }

      for (const item of issue.checklist) {
        const currentItem = await transaction.checklistItem.findUnique({
          where: { id: item.id },
          select: { issueId: true, updatedAt: true },
        });
        if (currentItem && currentItem.issueId !== issue.id)
          throw reparentConflict('Checklist item');
        if (!currentItem) {
          await transaction.checklistItem.create({ data: checklistCreateData(issue.id, item) });
        } else if (isNewer(item.updatedAt, currentItem.updatedAt)) {
          await transaction.checklistItem.update({
            where: { id: item.id },
            data: checklistUpdateData(item),
          });
        }
      }
    }
  }

  private async createProjectChildren(
    transaction: Prisma.TransactionClient,
    project: WorkspaceExport['projects'][number]
  ) {
    if (project.columns.length) {
      await transaction.boardColumn.createMany({
        data: project.columns.map((column) => columnCreateData(project.id, column)),
      });
    }
    if (project.sprints.length) {
      await transaction.sprint.createMany({
        data: project.sprints.map((sprint) => sprintCreateData(project.id, sprint)),
      });
    }
    if (project.issues.length) {
      await transaction.issue.createMany({
        data: project.issues.map((issue) => issueCreateData(project.id, issue)),
      });
      const checklistItems = project.issues.flatMap((issue) =>
        issue.checklist.map((item) => checklistCreateData(issue.id, item))
      );
      if (checklistItems.length) {
        await transaction.checklistItem.createMany({ data: checklistItems });
      }
    }
  }
}

function toDate(value: string | null) {
  return value ? new Date(value) : null;
}

function isNewer(incoming: string, existing: Date) {
  return new Date(incoming).getTime() > existing.getTime();
}

function reparentConflict(entity: string) {
  return new DomainConflictError(`${entity} cannot be moved to another parent during import`);
}

type ExportProject = WorkspaceExport['projects'][number];
type ExportColumn = ExportProject['columns'][number];
type ExportSprint = ExportProject['sprints'][number];
type ExportIssue = ExportProject['issues'][number];
type ExportChecklistItem = ExportIssue['checklist'][number];

function columnCreateData(projectId: string, column: ExportColumn) {
  return {
    id: column.id,
    projectId,
    ...columnUpdateData(column),
    createdAt: new Date(column.createdAt),
  };
}

function columnUpdateData(column: ExportColumn) {
  return {
    name: column.name,
    category: column.category,
    rank: BigInt(column.rank),
    wipLimit: column.wipLimit,
    version: column.version,
    archivedAt: toDate(column.archivedAt),
    updatedAt: new Date(column.updatedAt),
  };
}

function sprintCreateData(projectId: string, sprint: ExportSprint) {
  return {
    id: sprint.id,
    projectId,
    ...sprintUpdateData(sprint),
    createdAt: new Date(sprint.createdAt),
  };
}

function sprintUpdateData(sprint: ExportSprint) {
  return {
    name: sprint.name,
    goal: sprint.goal,
    status: sprint.status,
    startDate: new Date(`${sprint.startDate}T00:00:00.000Z`),
    endDate: new Date(`${sprint.endDate}T00:00:00.000Z`),
    plannedPoints: sprint.plannedPoints,
    plannedIssueCount: sprint.plannedIssueCount,
    completedPoints: sprint.completedPoints,
    completedIssueCount: sprint.completedIssueCount,
    incompletePoints: sprint.incompletePoints,
    incompleteIssueCount: sprint.incompleteIssueCount,
    completedAt: toDate(sprint.completedAt),
    version: sprint.version,
    updatedAt: new Date(sprint.updatedAt),
  };
}

function issueCreateData(projectId: string, issue: ExportIssue) {
  return {
    id: issue.id,
    projectId,
    ...issueUpdateData(issue),
    createdAt: new Date(issue.createdAt),
  };
}

function issueUpdateData(issue: ExportIssue) {
  return {
    sprintId: issue.sprintId,
    columnId: issue.columnId,
    title: issue.title,
    description: issue.description,
    type: issue.type,
    priority: issue.priority,
    labels: issue.labels,
    storyPoints: issue.storyPoints,
    rank: BigInt(issue.rank),
    version: issue.version,
    dueDate: toDate(issue.dueDate),
    isBlocked: issue.isBlocked,
    blockedReason: issue.blockedReason,
    archivedAt: toDate(issue.archivedAt),
    completedAt: toDate(issue.completedAt),
    updatedAt: new Date(issue.updatedAt),
  };
}

function checklistCreateData(issueId: string, item: ExportChecklistItem) {
  return {
    id: item.id,
    issueId,
    ...checklistUpdateData(item),
    createdAt: new Date(item.createdAt),
  };
}

function checklistUpdateData(item: ExportChecklistItem) {
  return {
    title: item.title,
    isCompleted: item.isCompleted,
    rank: BigInt(item.rank),
    updatedAt: new Date(item.updatedAt),
  };
}

function importEntityCounts(data: WorkspaceExport) {
  return data.projects.reduce(
    (counts, project) => ({
      projects: counts.projects + 1,
      columns: counts.columns + project.columns.length,
      sprints: counts.sprints + project.sprints.length,
      issues: counts.issues + project.issues.length,
      checklistItems:
        counts.checklistItems +
        project.issues.reduce((total, issue) => total + issue.checklist.length, 0),
    }),
    { projects: 0, columns: 0, sprints: 0, issues: 0, checklistItems: 0 }
  );
}
