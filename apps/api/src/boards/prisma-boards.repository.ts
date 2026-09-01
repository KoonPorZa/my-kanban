import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../database/prisma.service';
import { lockProjectTransaction } from '../database/project-transaction-lock';
import {
  ResourceNotFoundError,
  VersionConflictError,
  DomainValidationError,
} from '../common/domain/domain-errors';
import { rankForPosition, rebalancedRanks } from '../common/domain/rank';
import { BoardsRepository } from './boards.repository';
import { ColumnCategory } from './dto/column-mutation.dto';
import type {
  MoveColumnDto,
  CreateColumnDto,
  UpdateColumnDto,
  ArchiveColumnDto,
} from './dto/column-mutation.dto';

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
  sprintId: true,
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
  checklist: {
    select: { id: true, title: true, isCompleted: true },
    orderBy: { rank: 'asc' },
  },
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

  async get(ownerId: string, projectId: string, sprintId?: string) {
    return this.getScoped(projectId, ownerId, sprintId);
  }

  async getForProject(projectId: string) {
    return this.getScoped(projectId);
  }

  private async getScoped(projectId: string, ownerId?: string, sprintId?: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, archivedAt: null, ...(ownerId && { workspace: { ownerId } }) },
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
              where: { archivedAt: null, ...(sprintId && { sprintId }) },
              orderBy: { rank: 'asc' },
              select: boardIssueSelect,
            },
          },
        },
      },
    });
    if (!project) throw new ResourceNotFoundError('Project');
    if (sprintId) {
      const activeSprint = await this.prisma.sprint.findFirst({
        where: { id: sprintId, projectId: project.id, status: 'active' },
        select: { id: true },
      });
      if (!activeSprint) throw new ResourceNotFoundError('Active Sprint');
    }

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
      await lockProjectTransaction(transaction, project.id);

      const columns = await this.activeColumns(transaction, project.id);
      const category = input.category ?? ColumnCategory.in_progress;
      if (category === ColumnCategory.done && input.wipLimit != null) {
        throw new DomainValidationError('Done columns cannot have a WIP limit');
      }
      const defaultBeforeId = columns.at(-1)?.category === 'done' ? columns.at(-1)?.id : undefined;

      const rank = await this.resolveColumnRank(
        transaction,
        project.id,
        undefined,
        input.beforeColumnId ?? (input.afterColumnId ? undefined : defaultBeforeId),
        input.afterColumnId
      );
      this.assertColumnInvariants([
        ...columns,
        { id: 'new-column', rank, category, wipLimit: input.wipLimit ?? null },
      ]);
      return transaction.boardColumn.create({
        data: {
          projectId,
          name: input.name,
          category,
          wipLimit: input.wipLimit,
          rank,
        },
        select: columnSelect,
      });
    });
  }

  async updateColumn(ownerId: string, columnId: string, input: UpdateColumnDto) {
    return this.prisma.$transaction(async (transaction) => {
      await this.lockColumnProject(transaction, ownerId, columnId);
      const column = await this.findScopedColumn(transaction, ownerId, columnId, input.version);
      if (column.category === 'done' && input.wipLimit != null) {
        throw new DomainValidationError('Done columns cannot have a WIP limit');
      }
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
      await this.lockColumnProject(transaction, ownerId, columnId);
      const column = await this.findScopedColumn(transaction, ownerId, columnId, input.version);
      const rank = await this.resolveColumnRank(
        transaction,
        column.projectId,
        column.id,
        input.beforeColumnId,
        input.afterColumnId
      );
      const columns = await this.activeColumns(transaction, column.projectId);
      this.assertColumnInvariants(
        columns.map((item) => (item.id === column.id ? { ...item, rank } : item))
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

  async clearColumn(ownerId: string, columnId: string, version: number, sprintId?: string) {
    return this.prisma.$transaction(async (transaction) => {
      await this.lockColumnProject(transaction, ownerId, columnId);
      const column = await this.findScopedColumn(transaction, ownerId, columnId, version);
      const project = await transaction.project.findUniqueOrThrow({
        where: { id: column.projectId },
        select: { mode: true },
      });
      if (project.mode === 'scrum' && !sprintId) {
        throw new DomainValidationError('sprintId is required to clear a column in Scrum mode');
      }
      if (project.mode === 'kanban' && sprintId) {
        throw new DomainValidationError('sprintId is only supported in Scrum mode');
      }
      if (sprintId) {
        const sprint = await transaction.sprint.findFirst({
          where: { id: sprintId, projectId: column.projectId, status: 'active' },
          select: { id: true },
        });
        if (!sprint) throw new ResourceNotFoundError('Active Sprint');
      }
      const archivedAt = new Date();
      await transaction.issue.updateMany({
        where: { columnId: column.id, archivedAt: null, ...(sprintId && { sprintId }) },
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

  async archiveColumn(ownerId: string, columnId: string, input: ArchiveColumnDto) {
    return this.prisma.$transaction(async (transaction) => {
      await this.lockColumnProject(transaction, ownerId, columnId);
      const column = await this.findScopedColumn(transaction, ownerId, columnId, input.version);
      const columns = await this.activeColumns(transaction, column.projectId);
      this.assertColumnInvariants(columns.filter(({ id }) => id !== column.id));

      const tasks = await transaction.issue.findMany({
        where: { columnId: column.id, archivedAt: null },
        orderBy: { rank: 'asc' },
        select: { id: true, completedAt: true },
      });
      if (tasks.length > 0 && !input.destinationColumnId) {
        throw new DomainValidationError('destinationColumnId is required when a column has tasks');
      }

      if (input.destinationColumnId) {
        if (input.destinationColumnId === column.id) {
          throw new DomainValidationError('Destination column must be different');
        }
        const destination = columns.find(({ id }) => id === input.destinationColumnId);
        if (!destination) throw new ResourceNotFoundError('Destination Column');
        if (destination.category === 'done' && !input.allowIncompleteChecklist) {
          const incompleteChecklistCount = await transaction.checklistItem.count({
            where: {
              isCompleted: false,
              issue: { columnId: column.id, archivedAt: null },
            },
          });
          if (incompleteChecklistCount > 0) {
            throw new DomainValidationError(
              `Tasks in this column have ${incompleteChecklistCount} incomplete checklist item(s); confirm the move with allowIncompleteChecklist`
            );
          }
        }
        const lastTask = await transaction.issue.findFirst({
          where: { columnId: destination.id, archivedAt: null },
          orderBy: { rank: 'desc' },
          select: { rank: true },
        });
        const firstRank = (lastTask?.rank ?? 0n) + 1024n;
        for (const [index, task] of tasks.entries()) {
          await transaction.issue.update({
            where: { id: task.id },
            data: {
              columnId: destination.id,
              rank: firstRank + BigInt(index) * 1024n,
              completedAt:
                destination.category === 'done' ? (task.completedAt ?? new Date()) : null,
              version: { increment: 1 },
            },
          });
        }
      }

      const archivedAt = new Date();
      const result = await transaction.boardColumn.updateMany({
        where: { id: column.id, version: input.version, archivedAt: null },
        data: { archivedAt, version: { increment: 1 } },
      });
      if (result.count !== 1) throw new VersionConflictError('Column');
      return transaction.boardColumn.findUniqueOrThrow({
        where: { id: column.id },
        select: columnSelect,
      });
    });
  }

  private async activeColumns(transaction: Prisma.TransactionClient, projectId: string) {
    return transaction.boardColumn.findMany({
      where: { projectId, archivedAt: null },
      orderBy: { rank: 'asc' },
      select: { id: true, rank: true, category: true, wipLimit: true },
    });
  }

  private assertColumnInvariants(
    columns: Array<{
      id: string;
      rank: bigint;
      category: 'todo' | 'in_progress' | 'done';
      wipLimit: number | null;
    }>
  ) {
    const ordered = [...columns].sort((left, right) => (left.rank < right.rank ? -1 : 1));
    if (ordered[0]?.category !== 'todo') {
      throw new DomainValidationError('The first column must be a To do column');
    }
    if (ordered.at(-1)?.category !== 'done') {
      throw new DomainValidationError('The last column must be a Done column');
    }
    if (ordered.some((item) => item.category === 'done' && item.wipLimit !== null)) {
      throw new DomainValidationError('Done columns cannot have a WIP limit');
    }
  }

  private async lockColumnProject(
    transaction: Prisma.TransactionClient,
    ownerId: string,
    columnId: string
  ) {
    const column = await transaction.boardColumn.findFirst({
      where: { id: columnId, project: { archivedAt: null, workspace: { ownerId } } },
      select: { projectId: true },
    });
    if (!column) throw new ResourceNotFoundError('Column');
    await lockProjectTransaction(transaction, column.projectId);
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
      checklistIncompleteCount: issue.checklist.filter((item) => !item.isCompleted).length,
      dueDate: issue.dueDate?.toISOString() ?? null,
      completedAt: issue.completedAt?.toISOString() ?? null,
      createdAt: issue.createdAt.toISOString(),
      updatedAt: issue.updatedAt.toISOString(),
    };
  }
}
