import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import {
  DomainConflictError,
  DomainValidationError,
  ResourceNotFoundError,
  VersionConflictError,
} from '../common/domain/domain-errors';
import { PrismaService } from '../database/prisma.service';
import { lockProjectTransaction } from '../database/project-transaction-lock';
import { rankForPosition, rebalancedRanks } from '../common/domain/rank';
import type { CreateIssueDto } from '../issues/dto/issue-mutation.dto';
import type { CompleteSprintDto, CreateSprintDto } from './dto/sprint-mutation.dto';
import {
  assertIncompleteDestination,
  assertSprintTransition,
  calculateSprintMetrics,
} from './sprint-domain';
import { SprintsRepository } from './sprints.repository';

const sprintSelect = {
  id: true,
  projectId: true,
  name: true,
  goal: true,
  status: true,
  startDate: true,
  endDate: true,
  plannedPoints: true,
  plannedIssueCount: true,
  completedPoints: true,
  completedIssueCount: true,
  incompletePoints: true,
  incompleteIssueCount: true,
  completedAt: true,
  version: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { issues: { where: { archivedAt: null } } } },
} satisfies Prisma.SprintSelect;

type SelectedSprint = Prisma.SprintGetPayload<{ select: typeof sprintSelect }>;

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
  checklist: {
    select: { id: true, title: true, isCompleted: true },
    orderBy: { rank: 'asc' },
  },
  completedAt: true,
  version: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.IssueSelect;

type SelectedIssue = Prisma.IssueGetPayload<{ select: typeof issueSelect }>;

@Injectable()
export class PrismaSprintsRepository extends SprintsRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async list(ownerId: string, projectId: string) {
    await this.requireProject(this.prisma, ownerId, projectId);
    const [current, completed] = await Promise.all([
      this.prisma.sprint.findMany({
        where: { projectId, status: { in: ['planned', 'active'] } },
        orderBy: [{ startDate: 'asc' }, { createdAt: 'asc' }],
        select: sprintSelect,
      }),
      this.prisma.sprint.findMany({
        where: { projectId, status: 'completed' },
        orderBy: [{ completedAt: 'desc' }, { createdAt: 'desc' }],
        select: sprintSelect,
      }),
    ]);
    return { sprints: [...current, ...completed].map((sprint) => this.toDto(sprint)) };
  }

  async create(ownerId: string, projectId: string, input: CreateSprintDto) {
    return this.prisma.$transaction(async (transaction) => {
      await this.lockOwnedProject(transaction, ownerId, projectId);
      const project = await this.requireProject(transaction, ownerId, projectId);
      if (project.mode !== 'scrum') {
        throw new DomainValidationError('Sprints can only be created in a Scrum project');
      }
      return this.toDto(
        await transaction.sprint.create({
          data: {
            projectId,
            name: input.name.trim(),
            goal: input.goal.trim(),
            startDate: new Date(input.startDate),
            endDate: new Date(input.endDate),
          },
          select: sprintSelect,
        })
      );
    });
  }

  async addIssue(ownerId: string, sprintId: string, issueId: string) {
    return this.prisma.$transaction(async (transaction) => {
      await this.lockSprintProject(transaction, ownerId, sprintId);
      const sprint = await this.requireMutableSprint(transaction, ownerId, sprintId);
      const issue = await transaction.issue.findFirst({
        where: {
          id: issueId,
          projectId: sprint.projectId,
          archivedAt: null,
          project: { archivedAt: null, workspace: { ownerId } },
        },
        select: { id: true, sprintId: true },
      });
      if (!issue) throw new ResourceNotFoundError('Task');
      if (issue.sprintId === sprint.id) return this.getSprint(transaction, sprint.id);
      if (issue.sprintId !== null) {
        throw new DomainConflictError('Move the task to backlog before assigning another Sprint');
      }

      const result = await transaction.issue.updateMany({
        where: { id: issue.id, sprintId: null },
        data: { sprintId: sprint.id, version: { increment: 1 } },
      });
      if (result.count !== 1) throw new DomainConflictError('Task is no longer in backlog');
      return this.getSprint(transaction, sprint.id);
    });
  }

  async bulkAddIssues(ownerId: string, sprintId: string, issueIds: string[]) {
    return this.prisma.$transaction(async (transaction) => {
      await this.lockSprintProject(transaction, ownerId, sprintId);
      const sprint = await this.requireMutableSprint(transaction, ownerId, sprintId);
      const tasks = await transaction.issue.findMany({
        where: {
          id: { in: issueIds },
          projectId: sprint.projectId,
          archivedAt: null,
          project: { archivedAt: null, workspace: { ownerId } },
        },
        select: { id: true, sprintId: true },
      });
      if (tasks.length !== issueIds.length) throw new ResourceNotFoundError('Task');
      if (tasks.some((task) => task.sprintId !== null)) {
        throw new DomainConflictError('Only backlog tasks can be assigned to a Sprint');
      }

      const assigned = await transaction.issue.updateMany({
        where: {
          id: { in: issueIds },
          projectId: sprint.projectId,
          sprintId: null,
          archivedAt: null,
        },
        data: { sprintId: sprint.id, version: { increment: 1 } },
      });
      if (assigned.count !== issueIds.length) {
        throw new DomainConflictError('A selected task is no longer in backlog');
      }
      return this.getSprint(transaction, sprint.id);
    });
  }

  async createIssue(ownerId: string, sprintId: string, input: CreateIssueDto) {
    return this.prisma.$transaction(async (transaction) => {
      await this.lockSprintProject(transaction, ownerId, sprintId);
      const sprint = await this.requireMutableSprint(transaction, ownerId, sprintId);
      if (sprint.project.mode !== 'scrum') {
        throw new DomainValidationError('Tasks can only be created in a Sprint project');
      }

      const column = await transaction.boardColumn.findFirst({
        where: {
          id: input.columnId,
          projectId: sprint.projectId,
          archivedAt: null,
          project: { archivedAt: null, workspace: { ownerId } },
        },
        select: { id: true, category: true },
      });
      if (!column) throw new ResourceNotFoundError('Column');

      const rank = await this.resolveRank(
        transaction,
        column.id,
        input.beforeIssueId,
        input.afterIssueId
      );
      const issue = await transaction.issue.create({
        data: {
          projectId: sprint.projectId,
          sprintId: sprint.id,
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
          checklist: input.checklist?.length
            ? {
                create: input.checklist.map((item, index) => ({
                  ...(item.id && { id: item.id }),
                  title: item.title,
                  isCompleted: item.isCompleted ?? false,
                  rank: BigInt((index + 1) * 1024),
                })),
              }
            : undefined,
          completedAt: column.category === 'done' ? new Date() : null,
          rank,
        },
        select: issueSelect,
      });
      return this.toIssueDto(issue);
    });
  }

  async removeIssue(ownerId: string, sprintId: string, issueId: string) {
    return this.prisma.$transaction(async (transaction) => {
      await this.lockSprintProject(transaction, ownerId, sprintId);
      const sprint = await this.requireMutableSprint(transaction, ownerId, sprintId);
      const result = await transaction.issue.updateMany({
        where: {
          id: issueId,
          projectId: sprint.projectId,
          sprintId: sprint.id,
          archivedAt: null,
        },
        data: { sprintId: null, version: { increment: 1 } },
      });
      if (result.count !== 1) throw new ResourceNotFoundError('Task');
      return this.getSprint(transaction, sprint.id);
    });
  }

  async start(ownerId: string, sprintId: string, version: number) {
    try {
      return await this.prisma.$transaction(async (transaction) => {
        await this.lockSprintProject(transaction, ownerId, sprintId);
        const sprint = await this.requireSprint(transaction, ownerId, sprintId, version);
        assertSprintTransition(sprint.status, 'active');
        if (sprint.project.mode !== 'scrum') {
          throw new DomainValidationError('A Sprint can only start in a Scrum project');
        }

        const issues = await transaction.issue.findMany({
          where: { sprintId: sprint.id, projectId: sprint.projectId, archivedAt: null },
          select: { storyPoints: true },
        });
        if (issues.length === 0) {
          throw new DomainValidationError('A Sprint must have at least one task before it starts');
        }
        const metrics = calculateSprintMetrics(
          issues.map((issue) => ({ storyPoints: issue.storyPoints, isCompleted: false }))
        );
        const result = await transaction.sprint.updateMany({
          where: { id: sprint.id, version, status: 'planned' },
          data: {
            status: 'active',
            plannedPoints: metrics.plannedPoints,
            plannedIssueCount: metrics.issueCount,
            version: { increment: 1 },
          },
        });
        if (result.count !== 1) throw new VersionConflictError('Sprint');
        return this.getSprint(transaction, sprint.id);
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new DomainConflictError('Complete the active Sprint before starting another');
      }
      throw error;
    }
  }

  async complete(ownerId: string, sprintId: string, input: CompleteSprintDto) {
    return this.prisma.$transaction(async (transaction) => {
      await this.lockSprintProject(transaction, ownerId, sprintId);
      const sprint = await this.requireSprint(transaction, ownerId, sprintId, input.version);
      assertSprintTransition(sprint.status, 'completed');

      let destinationSprintId: string | null = null;
      if (input.incompleteDestination === 'backlog') {
        assertIncompleteDestination({ type: 'backlog' }, sprint.id);
      } else {
        const destination = await transaction.sprint.findFirst({
          where: {
            id: input.incompleteDestination,
            projectId: sprint.projectId,
            project: { archivedAt: null, workspace: { ownerId } },
          },
          select: { id: true, status: true },
        });
        if (!destination) throw new ResourceNotFoundError('Destination Sprint');
        assertIncompleteDestination(
          { type: 'sprint', sprintId: destination.id, status: destination.status },
          sprint.id
        );
        destinationSprintId = destination.id;
      }

      const issues = await transaction.issue.findMany({
        where: { sprintId: sprint.id, projectId: sprint.projectId, archivedAt: null },
        select: { id: true, storyPoints: true, column: { select: { category: true } } },
      });
      const metrics = calculateSprintMetrics(
        issues.map((issue) => ({
          storyPoints: issue.storyPoints,
          isCompleted: issue.column.category === 'done',
        }))
      );
      const incompleteIssueIds = issues
        .filter((issue) => issue.column.category !== 'done')
        .map((issue) => issue.id);

      if (incompleteIssueIds.length > 0) {
        await transaction.issue.updateMany({
          where: { id: { in: incompleteIssueIds }, sprintId: sprint.id },
          data: { sprintId: destinationSprintId, version: { increment: 1 } },
        });
      }

      const completedAt = new Date();
      const result = await transaction.sprint.updateMany({
        where: { id: sprint.id, version: input.version, status: 'active' },
        data: {
          status: 'completed',
          completedPoints: metrics.completedPoints,
          completedIssueCount: metrics.completedIssueCount,
          incompletePoints: metrics.incompletePoints,
          incompleteIssueCount: metrics.incompleteIssueCount,
          completedAt,
          version: { increment: 1 },
        },
      });
      if (result.count !== 1) throw new VersionConflictError('Sprint');
      return this.getSprint(transaction, sprint.id);
    });
  }

  private async requireProject(
    transaction: Prisma.TransactionClient | PrismaService,
    ownerId: string,
    projectId: string
  ) {
    const project = await transaction.project.findFirst({
      where: { id: projectId, archivedAt: null, workspace: { ownerId } },
      select: { id: true, mode: true },
    });
    if (!project) throw new ResourceNotFoundError('Project');
    return project;
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

  private async lockSprintProject(
    transaction: Prisma.TransactionClient,
    ownerId: string,
    sprintId: string
  ) {
    const sprint = await transaction.sprint.findFirst({
      where: { id: sprintId, project: { archivedAt: null, workspace: { ownerId } } },
      select: { projectId: true },
    });
    if (!sprint) throw new ResourceNotFoundError('Sprint');
    await lockProjectTransaction(transaction, sprint.projectId);
  }

  private async requireSprint(
    transaction: Prisma.TransactionClient,
    ownerId: string,
    sprintId: string,
    version?: number
  ) {
    const sprint = await transaction.sprint.findFirst({
      where: {
        id: sprintId,
        project: { archivedAt: null, workspace: { ownerId } },
      },
      select: {
        id: true,
        projectId: true,
        status: true,
        version: true,
        project: { select: { mode: true } },
      },
    });
    if (!sprint) throw new ResourceNotFoundError('Sprint');
    if (version !== undefined && sprint.version !== version) {
      throw new VersionConflictError('Sprint');
    }
    return sprint;
  }

  private async requireMutableSprint(
    transaction: Prisma.TransactionClient,
    ownerId: string,
    sprintId: string
  ) {
    const sprint = await this.requireSprint(transaction, ownerId, sprintId);
    if (sprint.status === 'completed') {
      throw new DomainValidationError('Tasks cannot be changed in a completed Sprint');
    }
    return sprint;
  }

  private async getSprint(transaction: Prisma.TransactionClient, sprintId: string) {
    return this.toDto(
      await transaction.sprint.findUniqueOrThrow({ where: { id: sprintId }, select: sprintSelect })
    );
  }

  private async resolveRank(
    transaction: Prisma.TransactionClient,
    columnId: string,
    beforeIssueId?: string,
    afterIssueId?: string
  ) {
    const siblings = await transaction.issue.findMany({
      where: { columnId, archivedAt: null },
      select: { id: true, rank: true },
    });
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
    if (rank === null) throw new DomainConflictError('Unable to position task');
    return rank;
  }

  private toIssueDto(issue: SelectedIssue) {
    return {
      ...issue,
      checklistIncompleteCount: issue.checklist.filter((item) => !item.isCompleted).length,
      dueDate: issue.dueDate?.toISOString() ?? null,
      completedAt: issue.completedAt?.toISOString() ?? null,
      createdAt: issue.createdAt.toISOString(),
      updatedAt: issue.updatedAt.toISOString(),
    };
  }

  private toDto(sprint: SelectedSprint) {
    return {
      id: sprint.id,
      projectId: sprint.projectId,
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
      issueCount: sprint._count.issues,
      completedAt: sprint.completedAt?.toISOString() ?? null,
      version: sprint.version,
      createdAt: sprint.createdAt.toISOString(),
      updatedAt: sprint.updatedAt.toISOString(),
    };
  }
}
