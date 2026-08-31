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
import { IssuesRepository } from './issues.repository';
import type { TaskListFilter } from './issues.repository';
import type { MoveIssueDto, CreateIssueDto, UpdateIssueDto } from './dto/issue-mutation.dto';

const issueSelect = {
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
  completedAt: true,
  version: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.IssueSelect;

type SelectedIssue = Prisma.IssueGetPayload<{ select: typeof issueSelect }>;

@Injectable()
export class PrismaIssuesRepository extends IssuesRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async create(ownerId: string, projectId: string, input: CreateIssueDto) {
    return this.prisma.$transaction(async (transaction) => {
      await this.lockOwnedProject(transaction, ownerId, projectId);
      return this.createWithTransaction(transaction, ownerId, projectId, input);
    });
  }

  async createMany(ownerId: string, projectId: string, inputs: CreateIssueDto[]) {
    return this.prisma.$transaction(async (transaction) => {
      await this.lockOwnedProject(transaction, ownerId, projectId);
      const created = [];
      for (const input of inputs) {
        created.push(await this.createWithTransaction(transaction, ownerId, projectId, input));
      }
      return created;
    });
  }

  async getForProject(projectId: string, issueId: string, includeArchived = false) {
    const issue = await this.prisma.issue.findFirst({
      where: {
        id: issueId,
        projectId,
        project: { archivedAt: null },
        ...(!includeArchived && { archivedAt: null }),
      },
      select: issueSelect,
    });
    if (!issue) throw new ResourceNotFoundError('Task');
    return this.toDto(issue);
  }

  async listForProject(projectId: string, filter: TaskListFilter) {
    const pageSize = filter.pageSize ?? 50;
    const archivedAt =
      filter.archived === 'all' ? undefined : filter.archived === 'archived' ? { not: null } : null;
    const issues = await this.prisma.issue.findMany({
      where: {
        projectId,
        project: { archivedAt: null },
        ...(archivedAt !== undefined && { archivedAt }),
        ...(filter.columnId && { columnId: filter.columnId }),
        ...(filter.priority && {
          priority: filter.priority as 'urgent' | 'high' | 'medium' | 'low' | 'none',
        }),
        ...(filter.query && {
          OR: [
            { title: { contains: filter.query, mode: 'insensitive' } },
            { description: { contains: filter.query, mode: 'insensitive' } },
          ],
        }),
      },
      select: issueSelect,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: pageSize + 1,
      ...(filter.cursor && { cursor: { id: filter.cursor }, skip: 1 }),
    });
    const hasNext = issues.length > pageSize;
    const page = hasNext ? issues.slice(0, pageSize) : issues;
    return {
      tasks: page.map((issue) => this.toDto(issue)),
      nextCursor: hasNext ? (page.at(-1)?.id ?? null) : null,
    };
  }

  async restoreForProject(
    projectId: string,
    issueId: string,
    version: number,
    targetColumnId?: string,
    beforeIssueId?: string,
    afterIssueId?: string
  ) {
    return this.prisma.$transaction(async (transaction) => {
      await this.lockIssueProject(transaction, projectId, issueId);
      const issue = await transaction.issue.findFirst({
        where: { id: issueId, projectId, archivedAt: { not: null }, project: { archivedAt: null } },
      });
      if (!issue) throw new ResourceNotFoundError('Task');
      if (issue.version !== version) throw new VersionConflictError('Task');

      const column = await transaction.boardColumn.findFirst({
        where: {
          id: targetColumnId ?? issue.columnId,
          projectId,
          archivedAt: null,
          project: { archivedAt: null },
        },
        select: { id: true, category: true },
      });
      if (!column) throw new ResourceNotFoundError('Column');

      const rank = await this.resolveRank(
        transaction,
        column.id,
        undefined,
        beforeIssueId,
        afterIssueId
      );
      const result = await transaction.issue.updateMany({
        where: { id: issue.id, projectId, version, archivedAt: { not: null } },
        data: {
          columnId: column.id,
          rank,
          archivedAt: null,
          completedAt: column.category === 'done' ? (issue.completedAt ?? new Date()) : null,
          version: { increment: 1 },
        },
      });
      if (result.count !== 1) throw new VersionConflictError('Task');

      return this.toDto(
        await transaction.issue.findUniqueOrThrow({ where: { id: issue.id }, select: issueSelect })
      );
    });
  }

  private async createWithTransaction(
    transaction: Prisma.TransactionClient,
    ownerId: string,
    projectId: string,
    input: CreateIssueDto
  ) {
    const column = await transaction.boardColumn.findFirst({
      where: {
        id: input.columnId,
        projectId,
        archivedAt: null,
        project: { archivedAt: null, workspace: { ownerId } },
      },
      select: { id: true, category: true },
    });
    if (!column) throw new ResourceNotFoundError('Column');

    const rank = await this.resolveRank(
      transaction,
      column.id,
      undefined,
      input.beforeIssueId,
      input.afterIssueId
    );
    const issue = await transaction.issue.create({
      data: {
        projectId,
        columnId: column.id,
        title: input.title,
        description: input.description ?? '',
        type: input.type ?? 'task',
        priority: input.priority ?? 'medium',
        labels: input.labels ?? [],
        storyPoints: input.storyPoints,
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        isBlocked: input.isBlocked ?? false,
        blockedReason: input.blockedReason?.trim() || null,
        completedAt: column.category === 'done' ? new Date() : null,
        rank,
      },
      select: issueSelect,
    });

    return this.toDto(issue);
  }

  async update(ownerId: string, issueId: string, input: UpdateIssueDto) {
    return this.prisma.$transaction(async (transaction) => {
      await this.lockOwnedIssueProject(transaction, ownerId, issueId);
      await this.findScopedIssue(transaction, ownerId, issueId, input.version);
      const { version, ...changes } = input;
      const result = await transaction.issue.updateMany({
        where: { id: issueId, version, archivedAt: null },
        data: {
          ...(changes.title !== undefined && { title: changes.title }),
          ...(changes.description !== undefined && { description: changes.description }),
          ...(changes.type !== undefined && { type: changes.type }),
          ...(changes.priority !== undefined && { priority: changes.priority }),
          ...(changes.labels !== undefined && { labels: changes.labels }),
          ...(changes.storyPoints !== undefined && { storyPoints: changes.storyPoints }),
          ...(changes.dueDate !== undefined && {
            dueDate: changes.dueDate ? new Date(changes.dueDate) : null,
          }),
          ...(changes.isBlocked !== undefined && { isBlocked: changes.isBlocked }),
          ...(changes.blockedReason !== undefined && {
            blockedReason: changes.blockedReason?.trim() || null,
          }),
          version: { increment: 1 },
        },
      });
      if (result.count !== 1) throw new VersionConflictError('Task');

      return this.toDto(
        await transaction.issue.findUniqueOrThrow({ where: { id: issueId }, select: issueSelect })
      );
    });
  }

  async move(ownerId: string, issueId: string, input: MoveIssueDto) {
    return this.prisma.$transaction(async (transaction) => {
      await this.lockOwnedIssueProject(transaction, ownerId, issueId);
      const issue = await this.findScopedIssue(transaction, ownerId, issueId, input.version);
      if (input.sprintId && issue.sprintId !== input.sprintId) {
        throw new DomainValidationError('Task is not in the requested Sprint scope');
      }
      if (input.sprintId) {
        const sprint = await transaction.sprint.findFirst({
          where: { id: input.sprintId, projectId: issue.projectId, status: 'active' },
          select: { id: true },
        });
        if (!sprint) throw new ResourceNotFoundError('Active Sprint');
      }
      const targetColumn = await transaction.boardColumn.findFirst({
        where: {
          id: input.targetColumnId,
          projectId: issue.projectId,
          archivedAt: null,
          project: { workspace: { ownerId }, archivedAt: null },
        },
        select: { id: true, category: true },
      });
      if (!targetColumn) throw new ResourceNotFoundError('Column');

      const rank = await this.resolveRank(
        transaction,
        targetColumn.id,
        issue.id,
        input.beforeIssueId,
        input.afterIssueId,
        input.sprintId
      );
      const result = await transaction.issue.updateMany({
        where: { id: issue.id, version: input.version, archivedAt: null },
        data: {
          columnId: targetColumn.id,
          rank,
          completedAt: targetColumn.category === 'done' ? (issue.completedAt ?? new Date()) : null,
          version: { increment: 1 },
        },
      });
      if (result.count !== 1) throw new VersionConflictError('Task');

      return this.toDto(
        await transaction.issue.findUniqueOrThrow({ where: { id: issue.id }, select: issueSelect })
      );
    });
  }

  async archive(ownerId: string, issueId: string, version: number) {
    return this.prisma.$transaction(async (transaction) => {
      await this.lockOwnedIssueProject(transaction, ownerId, issueId);
      await this.findScopedIssue(transaction, ownerId, issueId, version);
      const result = await transaction.issue.updateMany({
        where: { id: issueId, version, archivedAt: null },
        data: { archivedAt: new Date(), version: { increment: 1 } },
      });
      if (result.count !== 1) throw new VersionConflictError('Task');

      return this.toDto(
        await transaction.issue.findUniqueOrThrow({ where: { id: issueId }, select: issueSelect })
      );
    });
  }

  private async lockOwnedIssueProject(
    transaction: Prisma.TransactionClient,
    ownerId: string,
    issueId: string
  ) {
    const issue = await transaction.issue.findFirst({
      where: { id: issueId, project: { archivedAt: null, workspace: { ownerId } } },
      select: { projectId: true },
    });
    if (!issue) throw new ResourceNotFoundError('Task');
    await lockProjectTransaction(transaction, issue.projectId);
  }

  private async lockOwnedProject(
    transaction: Prisma.TransactionClient,
    ownerId: string,
    projectId: string
  ) {
    const project = await transaction.project.findFirst({
      where: { id: projectId, archivedAt: null, workspace: { ownerId } },
      select: { id: true },
    });
    if (!project) throw new ResourceNotFoundError('Project');
    await lockProjectTransaction(transaction, project.id);
  }

  private async lockIssueProject(
    transaction: Prisma.TransactionClient,
    projectId: string,
    issueId: string
  ) {
    const issue = await transaction.issue.findFirst({
      where: { id: issueId, projectId, project: { archivedAt: null } },
      select: { projectId: true },
    });
    if (!issue) throw new ResourceNotFoundError('Task');
    await lockProjectTransaction(transaction, issue.projectId);
  }

  private async findScopedIssue(
    transaction: Prisma.TransactionClient,
    ownerId: string,
    issueId: string,
    expectedVersion: number
  ) {
    const issue = await transaction.issue.findFirst({
      where: {
        id: issueId,
        archivedAt: null,
        project: { archivedAt: null, workspace: { ownerId } },
      },
    });
    if (!issue) throw new ResourceNotFoundError('Task');
    if (issue.version !== expectedVersion) throw new VersionConflictError('Task');
    return issue;
  }

  private async resolveRank(
    transaction: Prisma.TransactionClient,
    columnId: string,
    excludeIssueId?: string,
    beforeIssueId?: string,
    afterIssueId?: string,
    sprintId?: string
  ) {
    const siblings = await transaction.issue.findMany({
      where: {
        columnId,
        archivedAt: null,
        ...(excludeIssueId && { id: { not: excludeIssueId } }),
      },
      select: { id: true, rank: true },
      orderBy: { rank: 'asc' },
    });
    if (sprintId) {
      const scopedIds = new Set(
        await transaction.issue
          .findMany({
            where: { columnId, archivedAt: null, sprintId },
            select: { id: true },
          })
          .then((issues) => issues.map(({ id }) => id))
      );
      if (beforeIssueId && !scopedIds.has(beforeIssueId)) {
        throw new DomainValidationError('beforeIssueId is not in the requested Sprint scope');
      }
      if (afterIssueId && !scopedIds.has(afterIssueId)) {
        throw new DomainValidationError('afterIssueId is not in the requested Sprint scope');
      }
      if (beforeIssueId && afterIssueId) {
        const sorted = [...siblings].sort((left, right) => (left.rank < right.rank ? -1 : 1));
        const beforeIndex = sorted.findIndex(({ id }) => id === beforeIssueId);
        const afterIndex = sorted.findIndex(({ id }) => id === afterIssueId);
        if (afterIndex + 1 !== beforeIndex) afterIssueId = undefined;
      }
    }
    let rank = rankForPosition(siblings, beforeIssueId, afterIssueId);
    if (rank !== null) return rank;

    const rebalanced = rebalancedRanks(siblings);
    for (const [index, sibling] of rebalanced.entries()) {
      await transaction.issue.update({
        where: { id: sibling.id },
        data: { rank: -BigInt(index + 1) },
      });
    }
    for (const sibling of rebalanced) {
      await transaction.issue.update({ where: { id: sibling.id }, data: { rank: sibling.rank } });
    }

    rank = rankForPosition(rebalanced, beforeIssueId, afterIssueId);
    if (rank === null) throw new DomainValidationError('Unable to allocate task rank');
    return rank;
  }

  private toDto(issue: SelectedIssue) {
    return {
      ...issue,
      dueDate: issue.dueDate?.toISOString() ?? null,
      completedAt: issue.completedAt?.toISOString() ?? null,
      createdAt: issue.createdAt.toISOString(),
      updatedAt: issue.updatedAt.toISOString(),
    };
  }
}
