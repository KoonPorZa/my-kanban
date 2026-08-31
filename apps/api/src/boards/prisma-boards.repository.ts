import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../database/prisma.service';
import {
  ResourceNotFoundError,
  VersionConflictError,
  DomainValidationError,
} from '../common/domain/domain-errors';
import { rankForPosition, rebalancedRanks } from '../common/domain/rank';
import { BoardsRepository } from './boards.repository';
import type { MoveColumnDto, CreateColumnDto, UpdateColumnDto } from './dto/column-mutation.dto';

const columnSelect = {
  id: true,
  projectId: true,
  name: true,
  category: true,
  wipLimit: true,
  version: true,
} satisfies Prisma.BoardColumnSelect;

const boardIssueSelect = {
  id: true,
  projectId: true,
  columnId: true,
  title: true,
  description: true,
  type: true,
  priority: true,
  labels: true,
  storyPoints: true,
  dueDate: true,
  isBlocked: true,
  blockedReason: true,
  completedAt: true,
  version: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.IssueSelect;

type SelectedIssue = Prisma.IssueGetPayload<{ select: typeof boardIssueSelect }>;

@Injectable()
export class PrismaBoardsRepository extends BoardsRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async get(ownerId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, archivedAt: null, workspace: { ownerId } },
      select: {
        id: true,
        name: true,
        mode: true,
        version: true,
        columns: {
          where: { archivedAt: null },
          orderBy: { rank: 'asc' },
          select: {
            ...columnSelect,
            issues: {
              where: { archivedAt: null },
              orderBy: { rank: 'asc' },
              select: boardIssueSelect,
            },
          },
        },
      },
    });
    if (!project) throw new ResourceNotFoundError('Project');

    return {
      project: {
        id: project.id,
        name: project.name,
        mode: project.mode,
        version: project.version,
      },
      columns: project.columns.map((column) => ({
        id: column.id,
        projectId: column.projectId,
        name: column.name,
        category: column.category,
        wipLimit: column.wipLimit,
        version: column.version,
      })),
      issues: project.columns.flatMap((column) =>
        column.issues.map((issue) => this.issueDto(issue))
      ),
    };
  }

  async createColumn(ownerId: string, projectId: string, input: CreateColumnDto) {
    return this.prisma.$transaction(async (transaction) => {
      const project = await transaction.project.findFirst({
        where: { id: projectId, archivedAt: null, workspace: { ownerId } },
        select: { id: true },
      });
      if (!project) throw new ResourceNotFoundError('Project');

      const rank = await this.resolveColumnRank(
        transaction,
        project.id,
        undefined,
        input.beforeColumnId,
        input.afterColumnId
      );
      return transaction.boardColumn.create({
        data: {
          projectId,
          name: input.name,
          category: input.category ?? 'todo',
          wipLimit: input.wipLimit,
          rank,
        },
        select: columnSelect,
      });
    });
  }

  async updateColumn(ownerId: string, columnId: string, input: UpdateColumnDto) {
    return this.prisma.$transaction(async (transaction) => {
      await this.findScopedColumn(transaction, ownerId, columnId, input.version);
      const result = await transaction.boardColumn.updateMany({
        where: { id: columnId, version: input.version, archivedAt: null },
        data: {
          ...(input.name !== undefined && { name: input.name }),
          ...(input.wipLimit !== undefined && { wipLimit: input.wipLimit }),
          version: { increment: 1 },
        },
      });
      if (result.count !== 1) throw new VersionConflictError('Column');
      return transaction.boardColumn.findUniqueOrThrow({
        where: { id: columnId },
        select: columnSelect,
      });
    });
  }

  async moveColumn(ownerId: string, columnId: string, input: MoveColumnDto) {
    return this.prisma.$transaction(async (transaction) => {
      const column = await this.findScopedColumn(transaction, ownerId, columnId, input.version);
      const rank = await this.resolveColumnRank(
        transaction,
        column.projectId,
        column.id,
        input.beforeColumnId,
        input.afterColumnId
      );
      const result = await transaction.boardColumn.updateMany({
        where: { id: column.id, version: input.version, archivedAt: null },
        data: { rank, version: { increment: 1 } },
      });
      if (result.count !== 1) throw new VersionConflictError('Column');
      return transaction.boardColumn.findUniqueOrThrow({
        where: { id: column.id },
        select: columnSelect,
      });
    });
  }

  async clearColumn(ownerId: string, columnId: string, version: number) {
    return this.prisma.$transaction(async (transaction) => {
      const column = await this.findScopedColumn(transaction, ownerId, columnId, version);
      const archivedAt = new Date();
      await transaction.issue.updateMany({
        where: { columnId: column.id, archivedAt: null },
        data: { archivedAt, version: { increment: 1 } },
      });
      const result = await transaction.boardColumn.updateMany({
        where: { id: column.id, version, archivedAt: null },
        data: { version: { increment: 1 } },
      });
      if (result.count !== 1) throw new VersionConflictError('Column');
      return transaction.boardColumn.findUniqueOrThrow({
        where: { id: column.id },
        select: columnSelect,
      });
    });
  }

  async archiveColumn(ownerId: string, columnId: string, version: number) {
    return this.prisma.$transaction(async (transaction) => {
      const column = await this.findScopedColumn(transaction, ownerId, columnId, version);
      const archivedAt = new Date();
      await transaction.issue.updateMany({
        where: { columnId: column.id, archivedAt: null },
        data: { archivedAt, version: { increment: 1 } },
      });
      const result = await transaction.boardColumn.updateMany({
        where: { id: column.id, version, archivedAt: null },
        data: { archivedAt, version: { increment: 1 } },
      });
      if (result.count !== 1) throw new VersionConflictError('Column');
      return transaction.boardColumn.findUniqueOrThrow({
        where: { id: column.id },
        select: columnSelect,
      });
    });
  }

  private async findScopedColumn(
    transaction: Prisma.TransactionClient,
    ownerId: string,
    columnId: string,
    expectedVersion: number
  ) {
    const column = await transaction.boardColumn.findFirst({
      where: {
        id: columnId,
        archivedAt: null,
        project: { archivedAt: null, workspace: { ownerId } },
      },
    });
    if (!column) throw new ResourceNotFoundError('Column');
    if (column.version !== expectedVersion) throw new VersionConflictError('Column');
    return column;
  }

  private async resolveColumnRank(
    transaction: Prisma.TransactionClient,
    projectId: string,
    excludeColumnId?: string,
    beforeColumnId?: string,
    afterColumnId?: string
  ) {
    const siblings = await transaction.boardColumn.findMany({
      where: {
        projectId,
        archivedAt: null,
        ...(excludeColumnId && { id: { not: excludeColumnId } }),
      },
      select: { id: true, rank: true },
      orderBy: { rank: 'asc' },
    });
    let rank = rankForPosition(siblings, beforeColumnId, afterColumnId);
    if (rank !== null) return rank;

    const rebalanced = rebalancedRanks(siblings);
    for (const [index, sibling] of rebalanced.entries()) {
      await transaction.boardColumn.update({
        where: { id: sibling.id },
        data: { rank: -BigInt(index + 1) },
      });
    }
    for (const sibling of rebalanced) {
      await transaction.boardColumn.update({
        where: { id: sibling.id },
        data: { rank: sibling.rank },
      });
    }

    rank = rankForPosition(rebalanced, beforeColumnId, afterColumnId);
    if (rank === null) throw new DomainValidationError('Unable to allocate column rank');
    return rank;
  }

  private issueDto(issue: SelectedIssue) {
    return {
      ...issue,
      dueDate: issue.dueDate?.toISOString() ?? null,
      completedAt: issue.completedAt?.toISOString() ?? null,
      createdAt: issue.createdAt.toISOString(),
      updatedAt: issue.updatedAt.toISOString(),
    };
  }
}
