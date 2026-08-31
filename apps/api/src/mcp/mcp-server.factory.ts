import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod/v4';

import { BoardsService } from '../boards/boards.service';
import { DomainError, DomainValidationError } from '../common/domain/domain-errors';
import { IssuesService } from '../issues/issues.service';
import { TaskPriority, TaskType, type CreateIssueDto } from '../issues/dto/issue-mutation.dto';
import type { McpTokenPrincipal } from '../mcp-tokens/mcp-token.types';
import { McpInvocationsService } from './mcp-invocations.service';

const idempotencyKey = z.string().min(1).max(128);
const uuid = z.string().uuid();
const priority = z.enum(['urgent', 'high', 'medium', 'low', 'none']);
const taskType = z.enum(['task', 'story', 'bug', 'chore']);
const archiveFilter = z.enum(['active', 'archived', 'all']);

const createTaskFields = {
  title: z.string().trim().min(1).max(200),
  columnId: uuid.optional(),
  description: z.string().max(50_000).optional(),
  type: taskType.optional(),
  priority: priority.optional(),
  labels: z.array(z.string().max(60)).max(20).optional(),
  storyPoints: z.number().int().min(0).max(100).nullable().optional(),
  dueDate: z.string().datetime({ offset: true }).nullable().optional(),
  isBlocked: z.boolean().optional(),
  blockedReason: z.string().max(500).nullable().optional(),
  beforeIssueId: uuid.optional(),
  afterIssueId: uuid.optional(),
};

const taskPatch = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    description: z.string().max(50_000).optional(),
    type: taskType.optional(),
    priority: priority.optional(),
    labels: z.array(z.string().max(60)).max(20).optional(),
    storyPoints: z.number().int().min(0).max(100).nullable().optional(),
    dueDate: z.string().datetime({ offset: true }).nullable().optional(),
    isBlocked: z.boolean().optional(),
    blockedReason: z.string().max(500).nullable().optional(),
  })
  .strict()
  .refine((patch) => Object.keys(patch).length > 0, 'patch must contain at least one field');

type CreateTaskToolInput = Omit<CreateIssueDto, 'columnId' | 'type' | 'priority'> & {
  columnId?: string;
  type?: 'task' | 'story' | 'bug' | 'chore';
  priority?: 'urgent' | 'high' | 'medium' | 'low' | 'none';
};

@Injectable()
export class McpServerFactory {
  constructor(
    private readonly boards: BoardsService,
    private readonly issues: IssuesService,
    private readonly invocations: McpInvocationsService
  ) {}

  create(principal: McpTokenPrincipal) {
    const server = new McpServer(
      { name: 'my-kanban', version: '0.1.0' },
      {
        instructions:
          'This connection is bound to one Project. Never invent Project IDs. Read context before mutating tasks and use the latest task version.',
      }
    );

    server.registerTool(
      'get_context',
      {
        description: 'Get the Project and active Board Columns bound to this MCP token.',
        inputSchema: z.object({}).strict(),
        annotations: { readOnlyHint: true },
      },
      async () =>
        this.read(async () => ({
          ...(await this.boards.getForProject(principal.projectId)),
          token: {
            label: principal.tokenLabel,
            clientType: principal.clientType,
            expiresAt: principal.expiresAt.toISOString(),
            lastUsedAt: principal.lastUsedAt?.toISOString() ?? null,
          },
        }))
    );

    server.registerTool(
      'list_tasks',
      {
        description: 'List tasks in the bound Project with optional filters and cursor pagination.',
        inputSchema: z
          .object({
            columnId: uuid.optional(),
            priority: priority.optional(),
            archived: archiveFilter.optional(),
            cursor: uuid.optional(),
            pageSize: z.number().int().min(1).max(100).optional(),
          })
          .strict(),
        annotations: { readOnlyHint: true },
      },
      async (input) => this.read(() => this.issues.listForProject(principal.projectId, input))
    );

    server.registerTool(
      'search_tasks',
      {
        description: 'Search task titles and descriptions inside the bound Project.',
        inputSchema: z
          .object({
            query: z.string().trim().min(1).max(200),
            archived: archiveFilter.optional(),
            cursor: uuid.optional(),
            pageSize: z.number().int().min(1).max(100).optional(),
          })
          .strict(),
        annotations: { readOnlyHint: true },
      },
      async (input) => this.read(() => this.issues.listForProject(principal.projectId, input))
    );

    server.registerTool(
      'get_task',
      {
        description: 'Get one task from the bound Project.',
        inputSchema: z.object({ taskId: uuid, includeArchived: z.boolean().optional() }).strict(),
        annotations: { readOnlyHint: true },
      },
      async ({ taskId, includeArchived }) =>
        this.read(() =>
          this.issues.getForProject(principal.projectId, taskId, includeArchived ?? false)
        )
    );

    server.registerTool(
      'create_task',
      {
        description: 'Create one task in the bound Project.',
        inputSchema: z.object({ idempotencyKey, ...createTaskFields }).strict(),
        annotations: { destructiveHint: false, idempotentHint: true },
      },
      async ({ idempotencyKey: key, ...input }) =>
        this.mutation(
          principal,
          'create_task',
          key,
          input,
          Object.keys(input),
          undefined,
          async () =>
            this.issues.createForProject(
              principal.ownerId,
              principal.projectId,
              await this.createInput(principal.projectId, input)
            )
        )
    );

    server.registerTool(
      'create_tasks',
      {
        description: 'Atomically create between 1 and 10 tasks in the bound Project.',
        inputSchema: z
          .object({
            idempotencyKey,
            defaultColumnId: uuid.optional(),
            tasks: z.array(z.object(createTaskFields).strict()).min(1).max(10),
          })
          .strict(),
        annotations: { destructiveHint: false, idempotentHint: true },
      },
      async ({ idempotencyKey: key, defaultColumnId, tasks }) =>
        this.mutation(
          principal,
          'create_tasks',
          key,
          { defaultColumnId, tasks },
          ['tasks'],
          undefined,
          async () => {
            const inputs = await Promise.all(
              tasks.map((task) =>
                this.createInput(principal.projectId, {
                  ...task,
                  columnId: task.columnId ?? defaultColumnId,
                })
              )
            );
            return this.issues.createManyForProject(principal.ownerId, principal.projectId, inputs);
          }
        )
    );

    server.registerTool(
      'update_task',
      {
        description: 'Update one task using optimistic concurrency.',
        inputSchema: z
          .object({
            idempotencyKey,
            taskId: uuid,
            version: z.number().int().min(1),
            patch: taskPatch,
          })
          .strict(),
        annotations: { destructiveHint: false, idempotentHint: true },
      },
      async ({ idempotencyKey: key, taskId, version, patch }) =>
        this.mutation(
          principal,
          'update_task',
          key,
          { taskId, version, patch },
          Object.keys(patch),
          taskId,
          () =>
            this.issues.updateForProject(principal.ownerId, principal.projectId, taskId, {
              ...patch,
              type: patch.type as TaskType | undefined,
              priority: patch.priority as TaskPriority | undefined,
              version,
            })
        )
    );

    server.registerTool(
      'move_task',
      {
        description: 'Move or reorder one task using optimistic concurrency.',
        inputSchema: z
          .object({
            idempotencyKey,
            taskId: uuid,
            version: z.number().int().min(1),
            targetColumnId: uuid,
            beforeIssueId: uuid.optional(),
            afterIssueId: uuid.optional(),
          })
          .strict(),
        annotations: { destructiveHint: false, idempotentHint: true },
      },
      async ({ idempotencyKey: key, taskId, ...input }) =>
        this.mutation(
          principal,
          'move_task',
          key,
          { taskId, ...input },
          ['columnId', 'rank'],
          taskId,
          () => this.issues.moveForProject(principal.ownerId, principal.projectId, taskId, input)
        )
    );

    server.registerTool(
      'archive_task',
      {
        description: 'Archive one task using optimistic concurrency.',
        inputSchema: z
          .object({ idempotencyKey, taskId: uuid, version: z.number().int().min(1) })
          .strict(),
        annotations: { destructiveHint: true, idempotentHint: true },
      },
      async ({ idempotencyKey: key, taskId, version }) =>
        this.mutation(
          principal,
          'archive_task',
          key,
          { taskId, version },
          ['archivedAt'],
          taskId,
          () =>
            this.issues.archiveForProject(principal.ownerId, principal.projectId, taskId, version)
        )
    );

    server.registerTool(
      'restore_task',
      {
        description: 'Restore one archived task into an active Column.',
        inputSchema: z
          .object({
            idempotencyKey,
            taskId: uuid,
            version: z.number().int().min(1),
            targetColumnId: uuid.optional(),
            beforeIssueId: uuid.optional(),
            afterIssueId: uuid.optional(),
          })
          .strict(),
        annotations: { destructiveHint: false, idempotentHint: true },
      },
      async ({ idempotencyKey: key, taskId, version, ...position }) =>
        this.mutation(
          principal,
          'restore_task',
          key,
          { taskId, version, ...position },
          ['archivedAt', 'columnId', 'rank'],
          taskId,
          () =>
            this.issues.restoreForProject(
              principal.projectId,
              taskId,
              version,
              position.targetColumnId,
              position.beforeIssueId,
              position.afterIssueId
            )
        )
    );

    return server;
  }

  private async createInput(
    projectId: string,
    input: CreateTaskToolInput
  ): Promise<CreateIssueDto> {
    let columnId = input.columnId;
    if (!columnId) {
      const board = await this.boards.getForProject(projectId);
      columnId = board.columns[0]?.id;
    }
    if (!columnId) throw new DomainValidationError('The Project has no active Board Column');
    return {
      ...input,
      columnId,
      type: input.type as TaskType | undefined,
      priority: input.priority as TaskPriority | undefined,
    };
  }

  private async mutation<T>(
    principal: McpTokenPrincipal,
    toolName: string,
    key: string,
    payload: unknown,
    changedFields: string[],
    issueId: string | undefined,
    operation: () => Promise<T>
  ) {
    try {
      const result = await this.invocations.execute({
        principal,
        toolName,
        idempotencyKey: key,
        payload,
        changedFields,
        issueId,
        operation,
      });
      return this.success(result);
    } catch (error) {
      return this.failure(error);
    }
  }

  private async read(operation: () => Promise<unknown>) {
    try {
      return this.success(await operation());
    } catch (error) {
      return this.failure(error);
    }
  }

  private success(value: unknown) {
    const structuredContent = JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
    return {
      content: [{ type: 'text' as const, text: JSON.stringify(structuredContent) }],
      structuredContent,
    };
  }

  private failure(error: unknown) {
    const requestId =
      error && typeof error === 'object' && 'requestId' in error
        ? String(error.requestId)
        : randomUUID();
    const payload = {
      error: {
        code: error instanceof DomainError ? error.code : 'internal_error',
        message: error instanceof DomainError ? error.message : 'The tool call failed',
        requestId,
      },
    };
    return {
      isError: true,
      content: [{ type: 'text' as const, text: JSON.stringify(payload) }],
      structuredContent: payload,
    };
  }
}
