import type { Express } from 'express';

import express from 'express';
import request from 'supertest';
import { ConfigService } from '@nestjs/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { BoardsService } from '../src/boards/boards.service';
import { PrismaBoardsRepository } from '../src/boards/prisma-boards.repository';
import { PrismaService } from '../src/database/prisma.service';
import { IssuesService } from '../src/issues/issues.service';
import { PrismaIssuesRepository } from '../src/issues/prisma-issues.repository';
import { McpController } from '../src/mcp/mcp.controller';
import { McpServerFactory } from '../src/mcp/mcp-server.factory';
import { McpInvocationsService } from '../src/mcp/mcp-invocations.service';
import { PrismaMcpInvocationsRepository } from '../src/mcp/prisma-mcp-invocations.repository';
import { McpTokensService } from '../src/mcp-tokens/mcp-tokens.service';
import { PrismaMcpTokensRepository } from '../src/mcp-tokens/prisma-mcp-tokens.repository';
import { McpTokenClientType } from '../src/mcp-tokens/dto/mcp-token.dto';

describe('Project-scoped MCP task access', () => {
  let prisma: PrismaService;
  let app: Express;
  let controller: McpController;
  let tokens: McpTokensService;
  let ownerId: string;
  let projectAId: string;
  let projectBId: string;
  let columnAId: string;
  let doneColumnAId: string;
  let columnBId: string;
  let projectBTaskId: string;
  let tokenId: string;
  let rawToken: string;
  let sessionId: string;
  let mcpTaskId: string;
  let requestId = 1;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.onModuleInit();
    await cleanupFixtures();
    await createFixture();

    const boards = new BoardsService(new PrismaBoardsRepository(prisma));
    const issues = new IssuesService(new PrismaIssuesRepository(prisma));
    tokens = new McpTokensService(new PrismaMcpTokensRepository(prisma));
    const invocations = new McpInvocationsService(new PrismaMcpInvocationsRepository(prisma));
    const servers = new McpServerFactory(boards, issues, invocations);
    controller = new McpController(
      tokens,
      servers,
      new ConfigService({ APP_ORIGIN: 'http://localhost:8083' })
    );

    app = express();
    app.use(express.json());
    app.all('/mcp', (incoming, response) => void controller.handle(incoming, response));

    const created = await tokens.create(ownerId, projectAId, {
      label: 'Integration Codex',
      clientType: McpTokenClientType.codex,
    });
    tokenId = created.id;
    rawToken = created.rawToken;
    const stored = await prisma.mcpAccessToken.findUniqueOrThrow({ where: { id: tokenId } });
    expect(stored.tokenHash).not.toContain(rawToken);
    expect(JSON.stringify(stored)).not.toContain(rawToken);
    expect(stored.expiresAt.getTime() - stored.createdAt.getTime()).toBe(90 * 24 * 60 * 60 * 1000);
    expect(JSON.stringify(await tokens.list(ownerId, projectAId))).not.toContain(rawToken);

    const initialized = await rpc({
      jsonrpc: '2.0',
      id: requestId++,
      method: 'initialize',
      params: {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'integration-client', version: '1.0.0' },
      },
    });
    expect(initialized.status).toBe(200);
    sessionId = initialized.headers['mcp-session-id'];
    expect(sessionId).toBeTypeOf('string');

    const notification = await rpc(
      { jsonrpc: '2.0', method: 'notifications/initialized' },
      rawToken,
      sessionId
    );
    expect([200, 202]).toContain(notification.status);
  });

  afterAll(async () => {
    await controller?.onModuleDestroy();
    await cleanupFixtures();
    await prisma?.onModuleDestroy();
  });

  it('publishes the required tool surface and Project-bound context', async () => {
    const listed = await call('tools/list', {});
    const names = listed.body.result.tools.map((tool: { name: string }) => tool.name);
    expect(names).toEqual(
      expect.arrayContaining([
        'get_context',
        'list_tasks',
        'search_tasks',
        'get_task',
        'create_task',
        'create_tasks',
        'update_task',
        'move_task',
        'archive_task',
        'restore_task',
      ])
    );

    const context = await tool('get_context', {});
    expect(context.structuredContent.project.id).toBe(projectAId);
    expect(context.structuredContent.project.id).not.toBe(projectBId);
    expect(context.structuredContent.columns).toContainEqual(
      expect.objectContaining({ id: columnAId })
    );
  });

  it('does not reveal tasks from another Project owned by the same user', async () => {
    const result = await tool('get_task', { taskId: projectBTaskId });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('not_found');
    expect(result.content[0].text).not.toContain('Project B task');
  });

  it('keeps simultaneous client sessions bound to their own Projects', async () => {
    const projectBToken = await tokens.create(ownerId, projectBId, {
      label: 'Integration Claude',
      clientType: McpTokenClientType.claude,
    });
    const initialized = await rpc(
      {
        jsonrpc: '2.0',
        id: requestId++,
        method: 'initialize',
        params: {
          protocolVersion: '2025-06-18',
          capabilities: {},
          clientInfo: { name: 'second-client', version: '1.0.0' },
        },
      },
      projectBToken.rawToken
    );
    const projectBSessionId = initialized.headers['mcp-session-id'];
    expect(projectBSessionId).toBeTypeOf('string');
    await rpc(
      { jsonrpc: '2.0', method: 'notifications/initialized' },
      projectBToken.rawToken,
      projectBSessionId
    );

    const context = await rpc(
      {
        jsonrpc: '2.0',
        id: requestId++,
        method: 'tools/call',
        params: { name: 'get_context', arguments: {} },
      },
      projectBToken.rawToken,
      projectBSessionId
    );
    expect(context.body.result.structuredContent.project.id).toBe(projectBId);

    const projectBTask = await rpc(
      {
        jsonrpc: '2.0',
        id: requestId++,
        method: 'tools/call',
        params: { name: 'get_task', arguments: { taskId: projectBTaskId } },
      },
      projectBToken.rawToken,
      projectBSessionId
    );
    expect(projectBTask.body.result.structuredContent.id).toBe(projectBTaskId);
    expect(projectBTask.body.result.structuredContent.projectId).toBe(projectBId);
  });

  it('replays idempotent creates without duplicating tasks', async () => {
    const input = { idempotencyKey: 'create-once', title: 'Created by MCP', columnId: columnAId };
    const first = await tool('create_task', input);
    const replay = await tool('create_task', input);

    expect(first.structuredContent.replayed).toBe(false);
    expect(replay.structuredContent.replayed).toBe(true);
    expect(replay.structuredContent.result.id).toBe(first.structuredContent.result.id);
    mcpTaskId = first.structuredContent.result.id;
    expect(
      await prisma.issue.count({ where: { projectId: projectAId, title: 'Created by MCP' } })
    ).toBe(1);
  });

  it('updates, moves, searches, archives, and restores one task with version checks', async () => {
    const updated = await tool('update_task', {
      idempotencyKey: 'update-task',
      taskId: mcpTaskId,
      version: 1,
      patch: { title: 'MCP lifecycle task', priority: 'high' },
    });
    expect(updated.structuredContent.result).toMatchObject({
      title: 'MCP lifecycle task',
      priority: 'high',
      version: 2,
    });

    const moved = await tool('move_task', {
      idempotencyKey: 'move-task',
      taskId: mcpTaskId,
      version: 2,
      targetColumnId: doneColumnAId,
    });
    expect(moved.structuredContent.result).toMatchObject({
      columnId: doneColumnAId,
      version: 3,
    });
    expect(moved.structuredContent.result.completedAt).not.toBeNull();

    const searched = await tool('search_tasks', { query: 'lifecycle' });
    expect(searched.structuredContent.tasks).toContainEqual(
      expect.objectContaining({ id: mcpTaskId })
    );

    const archived = await tool('archive_task', {
      idempotencyKey: 'archive-task',
      taskId: mcpTaskId,
      version: 3,
    });
    expect(archived.structuredContent.result.version).toBe(4);

    const restored = await tool('restore_task', {
      idempotencyKey: 'restore-task',
      taskId: mcpTaskId,
      version: 4,
      targetColumnId: columnAId,
    });
    expect(restored.structuredContent.result).toMatchObject({
      columnId: columnAId,
      version: 5,
    });
  });

  it('limits create_tasks to 10 and rolls back an invalid atomic batch', async () => {
    const before = await prisma.issue.count({ where: { projectId: projectAId } });
    const oversized = await tool('create_tasks', {
      idempotencyKey: 'oversized',
      defaultColumnId: columnAId,
      tasks: Array.from({ length: 11 }, (_value, index) => ({ title: `Task ${index}` })),
    });
    expect(oversized.isError).toBe(true);
    expect(await prisma.issue.count({ where: { projectId: projectAId } })).toBe(before);

    const invalidBatch = await tool('create_tasks', {
      idempotencyKey: 'atomic-invalid',
      defaultColumnId: columnAId,
      tasks: [
        { title: 'Would otherwise persist' },
        { title: 'Wrong column', columnId: '00000000-0000-4000-8000-000000000000' },
      ],
    });
    expect(invalidBatch.isError).toBe(true);
    expect(await prisma.issue.count({ where: { projectId: projectAId } })).toBe(before);
  });

  it('records mutation audit events and rejects a revoked token immediately', async () => {
    const events = await prisma.mcpAuditEvent.findMany({ where: { tokenId } });
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ toolName: 'create_task', outcome: 'success' }),
        expect.objectContaining({ toolName: 'create_tasks', outcome: 'rejected' }),
      ])
    );

    const rejectedOrigin = await request(app)
      .post('/mcp')
      .set('Authorization', `Bearer ${rawToken}`)
      .set('MCP-Session-Id', sessionId)
      .set('Origin', 'https://attacker.invalid')
      .send({ jsonrpc: '2.0', id: requestId++, method: 'tools/list', params: {} });
    expect(rejectedOrigin.status).toBe(401);

    await tokens.revoke(ownerId, projectAId, tokenId);
    const rejected = await rpc(
      { jsonrpc: '2.0', id: requestId++, method: 'tools/list', params: {} },
      rawToken,
      sessionId
    );
    expect(rejected.status).toBe(401);
    expect(rejected.body.error.message).not.toContain(rawToken);
  });

  async function call(method: string, params: unknown) {
    return rpc({ jsonrpc: '2.0', id: requestId++, method, params }, rawToken, sessionId);
  }

  async function tool(name: string, args: unknown) {
    const response = await call('tools/call', { name, arguments: args });
    expect(response.status).toBe(200);
    return response.body.result;
  }

  function rpc(body: object, token = rawToken, currentSessionId?: string) {
    let pending = request(app)
      .post('/mcp')
      .set('Authorization', `Bearer ${token}`)
      .set('Accept', 'application/json, text/event-stream')
      .set('MCP-Protocol-Version', '2025-06-18')
      .send(body);
    if (currentSessionId) pending = pending.set('MCP-Session-Id', currentSessionId);
    return pending;
  }

  async function createFixture() {
    const user = await prisma.user.create({ data: { displayName: 'Integration MCP owner' } });
    ownerId = user.id;
    const workspace = await prisma.workspace.create({
      data: { ownerId, name: 'Integration MCP workspace' },
    });
    const [projectA, projectB] = await Promise.all([
      prisma.project.create({ data: { workspaceId: workspace.id, name: 'Project A' } }),
      prisma.project.create({ data: { workspaceId: workspace.id, name: 'Project B' } }),
    ]);
    projectAId = projectA.id;
    projectBId = projectB.id;
    const [columnA, doneColumnA, columnB] = await Promise.all([
      prisma.boardColumn.create({
        data: { projectId: projectA.id, name: 'To do', rank: 1024n },
      }),
      prisma.boardColumn.create({
        data: { projectId: projectA.id, name: 'Done', category: 'done', rank: 2048n },
      }),
      prisma.boardColumn.create({
        data: { projectId: projectB.id, name: 'To do', rank: 1024n },
      }),
    ]);
    columnAId = columnA.id;
    doneColumnAId = doneColumnA.id;
    columnBId = columnB.id;
    const projectBTask = await prisma.issue.create({
      data: {
        projectId: projectB.id,
        columnId: columnB.id,
        title: 'Project B task',
        rank: 1024n,
      },
    });
    projectBTaskId = projectBTask.id;
  }

  async function cleanupFixtures() {
    const users = await prisma.user.findMany({
      where: { displayName: 'Integration MCP owner' },
      select: { id: true },
    });
    const userIds = users.map(({ id }) => id);
    if (!userIds.length) return;
    const projects = await prisma.project.findMany({
      where: { workspace: { ownerId: { in: userIds } } },
      select: { id: true },
    });
    const projectIds = projects.map(({ id }) => id);
    await prisma.mcpAuditEvent.deleteMany({ where: { projectId: { in: projectIds } } });
    await prisma.mutationIdempotency.deleteMany({ where: { projectId: { in: projectIds } } });
    await prisma.mcpAccessToken.deleteMany({ where: { projectId: { in: projectIds } } });
    await prisma.workspace.deleteMany({ where: { ownerId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }
});
