import { Injectable } from '@nestjs/common';

import { PrismaService } from '../database/prisma.service';
import { ProjectsRepository } from './projects.repository';

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
}
