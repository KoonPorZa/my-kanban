import { Injectable } from '@nestjs/common';
import { ProjectMode } from '@prisma/client';

import { PrismaService } from '../database/prisma.service';
import { lockProjectTransaction } from '../database/project-transaction-lock';
import {
  DomainConflictError,
  ResourceNotFoundError,
  VersionConflictError,
} from '../common/domain/domain-errors';
import { ProjectsRepository } from './projects.repository';
import type { UpdateProjectModeDto } from './dto/project-mutation.dto';
import { ProjectModeDto } from './dto/project-mutation.dto';

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
          select: {
            id: true,
            name: true,
            color: true,
            mode: true,
            version: true,
          },
        },
      },
    });

    if (!workspace) return { activeProjectId: null, projects: [] };

    const activeProjectId = workspace.projects.some(
      (project) => project.id === workspace.activeProjectId
    )
      ? workspace.activeProjectId
      : (workspace.projects[0]?.id ?? null);

    return {
      activeProjectId,
      projects: workspace.projects,
    };
  }

  async updateMode(ownerId: string, projectId: string, input: UpdateProjectModeDto) {
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
        data: { mode: input.mode, version: { increment: 1 } },
      });
      if (result.count !== 1) throw new VersionConflictError('Project');
      return transaction.project.findUniqueOrThrow({
        where: { id: projectId },
        select: { id: true, name: true, color: true, mode: true, version: true },
      });
    });
  }
}
