import { Injectable } from '@nestjs/common';
import { ProjectMode } from '@prisma/client';

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
import { ProjectsRepository } from './projects.repository';
import type { CreateProjectDto, UpdateProjectDto } from './dto/project-mutation.dto';
import { ProjectModeDto } from './dto/project-mutation.dto';

const PROJECT_SUMMARY_SELECT = {
  id: true,
  name: true,
  color: true,
  mode: true,
  version: true,
  doneRetentionDays: true,
} as const;

const DEFAULT_COLUMNS = [
  { name: 'To do', category: 'todo' },
  { name: 'In progress', category: 'in_progress' },
  { name: 'Review', category: 'in_progress' },
  { name: 'Done', category: 'done' },
] as const;

@Injectable()
export class PrismaProjectsRepository extends ProjectsRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async listForOwner(ownerId: string) {
    const workspace = await this.prisma.workspace.findFirst({
      where: { ownerId },
      orderBy: { createdAt: 'asc' },
      include: {
        projects: {
          where: { archivedAt: null },
          orderBy: { createdAt: 'asc' },
          select: PROJECT_SUMMARY_SELECT,
        },
      },
    });

    if (!workspace) return { activeProjectId: null, projects: [] };

    const activeProjectId = workspace.projects.some(
      (project) => project.id === workspace.activeProjectId
    )
      ? workspace.activeProjectId
      : (workspace.projects[0]?.id ?? null);

    return { activeProjectId, projects: workspace.projects };
  }

  async create(ownerId: string, input: CreateProjectDto) {
    return this.prisma.$transaction(async (transaction) => {
      const workspaceId = await lockOwnerWorkspaceTransaction(transaction, ownerId);
      if (!workspaceId) throw new ResourceNotFoundError('Workspace');

      const project = await transaction.project.create({
        data: {
          workspaceId,
          name: input.name,
          color: input.color,
          mode: input.mode,
        },
        select: PROJECT_SUMMARY_SELECT,
      });
      await transaction.boardColumn.createMany({
        data: DEFAULT_COLUMNS.map((column, index) => ({
          projectId: project.id,
          name: column.name,
          category: column.category,
          rank: BigInt((index + 1) * 1024),
        })),
      });
      await transaction.workspace.update({
        where: { id: workspaceId },
        data: { activeProjectId: project.id, version: { increment: 1 } },
      });
      return project;
    });
  }

  async update(ownerId: string, projectId: string, input: UpdateProjectDto) {
    if (
      input.name === undefined &&
      input.color === undefined &&
      input.mode === undefined &&
      input.doneRetentionDays === undefined
    ) {
      throw new DomainValidationError('At least one project field must be provided');
    }

    return this.prisma.$transaction(async (transaction) => {
      const ownedProject = await transaction.project.findFirst({
        where: { id: projectId, archivedAt: null, workspace: { ownerId } },
        select: { id: true },
      });
      if (!ownedProject) throw new ResourceNotFoundError('Project');
      await lockProjectTransaction(transaction, ownedProject.id);

      const project = await transaction.project.findFirst({
        where: { id: projectId, archivedAt: null, workspace: { ownerId } },
        select: { id: true, mode: true, version: true },
      });
      if (!project) throw new ResourceNotFoundError('Project');
      if (project.version !== input.version) throw new VersionConflictError('Project');

      if (input.mode === ProjectModeDto.kanban && project.mode === ProjectMode.scrum) {
        const activeSprint = await transaction.sprint.findFirst({
          where: { projectId, status: 'active' },
          select: { id: true },
        });
        if (activeSprint) {
          throw new DomainConflictError('Complete the active Sprint before switching to Kanban');
        }
      }

      const result = await transaction.project.updateMany({
        where: { id: projectId, version: input.version, archivedAt: null },
        data: {
          name: input.name,
          color: input.color,
          mode: input.mode,
          doneRetentionDays: input.doneRetentionDays,
          version: { increment: 1 },
        },
      });
      if (result.count !== 1) throw new VersionConflictError('Project');
      return transaction.project.findUniqueOrThrow({
        where: { id: projectId },
        select: PROJECT_SUMMARY_SELECT,
      });
    });
  }

  async activate(ownerId: string, projectId: string) {
    return this.prisma.$transaction(async (transaction) => {
      const ownedProject = await transaction.project.findFirst({
        where: { id: projectId, archivedAt: null, workspace: { ownerId } },
        select: { id: true, workspaceId: true },
      });
      if (!ownedProject) throw new ResourceNotFoundError('Project');
      await lockWorkspaceTransaction(transaction, ownedProject.workspaceId);
      await lockProjectTransaction(transaction, ownedProject.id);
      const project = await transaction.project.findFirst({
        where: { id: projectId, archivedAt: null, workspace: { ownerId } },
        select: { ...PROJECT_SUMMARY_SELECT, workspaceId: true },
      });
      if (!project) throw new ResourceNotFoundError('Project');
      await transaction.workspace.update({
        where: { id: project.workspaceId },
        data: { activeProjectId: project.id, version: { increment: 1 } },
      });
      return {
        id: project.id,
        name: project.name,
        color: project.color,
        mode: project.mode,
        version: project.version,
        doneRetentionDays: project.doneRetentionDays,
      };
    });
  }

  async archive(ownerId: string, projectId: string, version: number) {
    return this.prisma.$transaction(async (transaction) => {
      const project = await transaction.project.findFirst({
        where: { id: projectId, archivedAt: null, workspace: { ownerId } },
        select: { id: true, workspaceId: true },
      });
      if (!project) throw new ResourceNotFoundError('Project');
      await lockWorkspaceTransaction(transaction, project.workspaceId);
      await lockProjectTransaction(transaction, project.id);

      const activeProjectCount = await transaction.project.count({
        where: { workspaceId: project.workspaceId, archivedAt: null },
      });
      if (activeProjectCount <= 1) {
        throw new DomainConflictError('At least one active Project must remain');
      }

      const archived = await transaction.project.updateMany({
        where: { id: project.id, version, archivedAt: null },
        data: { archivedAt: new Date(), version: { increment: 1 } },
      });
      if (archived.count !== 1) throw new VersionConflictError('Project');

      const workspace = await transaction.workspace.findUniqueOrThrow({
        where: { id: project.workspaceId },
        select: { activeProjectId: true },
      });
      if (workspace.activeProjectId === project.id) {
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

      const [projects, activeWorkspace] = await Promise.all([
        transaction.project.findMany({
          where: { workspaceId: project.workspaceId, archivedAt: null },
          orderBy: { createdAt: 'asc' },
          select: PROJECT_SUMMARY_SELECT,
        }),
        transaction.workspace.findUniqueOrThrow({
          where: { id: project.workspaceId },
          select: { activeProjectId: true },
        }),
      ]);
      return { activeProjectId: activeWorkspace.activeProjectId, projects };
    });
  }
}
