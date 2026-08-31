import { Injectable } from '@nestjs/common';

import { PrismaService } from '../database/prisma.service';
import { ResourceNotFoundError } from '../common/domain/domain-errors';
import { McpTokensRepository } from './mcp-tokens.repository';
import type { CreateMcpTokenDto } from './dto/mcp-token.dto';

@Injectable()
export class PrismaMcpTokensRepository extends McpTokensRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async create(
    ownerId: string,
    projectId: string,
    input: CreateMcpTokenDto & {
      tokenPrefix: string;
      tokenHash: string;
      expiresAt: Date;
      createdAt: Date;
    }
  ) {
    return this.prisma.$transaction(async (transaction) => {
      const project = await transaction.project.findFirst({
        where: { id: projectId, archivedAt: null, workspace: { ownerId } },
        select: { id: true, name: true },
      });
      if (!project) throw new ResourceNotFoundError('Project');

      const token = await transaction.mcpAccessToken.create({
        data: {
          projectId,
          createdById: ownerId,
          label: input.label,
          clientType: input.clientType,
          tokenPrefix: input.tokenPrefix,
          tokenHash: input.tokenHash,
          expiresAt: input.expiresAt,
          createdAt: input.createdAt,
        },
      });
      return { ...token, projectName: project.name };
    });
  }

  async list(ownerId: string, projectId: string) {
    const tokens = await this.prisma.mcpAccessToken.findMany({
      where: { projectId, project: { archivedAt: null, workspace: { ownerId } } },
      include: { project: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return tokens.map(({ project, ...token }) => ({ ...token, projectName: project.name }));
  }

  async revoke(ownerId: string, projectId: string, tokenId: string) {
    return this.prisma.$transaction(async (transaction) => {
      const token = await transaction.mcpAccessToken.findFirst({
        where: { id: tokenId, projectId, project: { archivedAt: null, workspace: { ownerId } } },
        include: { project: { select: { name: true } } },
      });
      if (!token) throw new ResourceNotFoundError('MCP token');

      const revoked = token.revokedAt
        ? token
        : await transaction.mcpAccessToken.update({
            where: { id: token.id },
            data: { revokedAt: new Date() },
            include: { project: { select: { name: true } } },
          });
      const { project, ...record } = revoked;
      return { ...record, projectName: project.name };
    });
  }

  async findByPrefix(prefix: string) {
    const token = await this.prisma.mcpAccessToken.findUnique({
      where: { tokenPrefix: prefix },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            archivedAt: true,
            workspace: { select: { ownerId: true } },
          },
        },
      },
    });
    if (!token || token.project.archivedAt) return null;

    const { project, ...record } = token;
    return {
      ...record,
      projectName: project.name,
      tokenId: record.id,
      tokenLabel: record.label,
      ownerId: project.workspace.ownerId,
    };
  }

  async markUsed(tokenId: string, usedAt: Date) {
    await this.prisma.mcpAccessToken.updateMany({
      where: { id: tokenId, revokedAt: null, expiresAt: { gt: usedAt } },
      data: { lastUsedAt: usedAt },
    });
  }

  async listAudit(ownerId: string, projectId: string) {
    const events = await this.prisma.mcpAuditEvent.findMany({
      where: { projectId, project: { archivedAt: null, workspace: { ownerId } } },
      include: { token: { select: { label: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return events.map(({ token, ...event }) => ({ ...event, tokenLabel: token.label }));
  }
}
