import type { NextFunction, Request, Response } from 'express';
import type { INestApplication } from '@nestjs/common';

import request from 'supertest';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ValidationPipe, VersioningType } from '@nestjs/common';

import { BoardsService } from '../src/boards/boards.service';
import { BoardsController } from '../src/boards/boards.controller';
import { PrismaBoardsRepository } from '../src/boards/prisma-boards.repository';
import { PrismaService } from '../src/database/prisma.service';
import { IssuesService } from '../src/issues/issues.service';
import { IssuesController } from '../src/issues/issues.controller';
import { PrismaIssuesRepository } from '../src/issues/prisma-issues.repository';
import { CreateIssueDto } from '../src/issues/dto/issue-mutation.dto';
import { DomainExceptionFilter } from '../src/common/http/domain-exception.filter';

describe('Board HTTP API', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let userId: string;
  let projectId: string;
  let columnId: string;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.onModuleInit();
    await cleanupFixtures();
    // Vitest's esbuild transform does not emit TypeScript decorator metadata.
    Reflect.defineMetadata(
      'design:paramtypes',
      [Object, String, CreateIssueDto],
      IssuesController.prototype,
      'create'
    );
    const boards = new BoardsService(new PrismaBoardsRepository(prisma));
    const issues = new IssuesService(new PrismaIssuesRepository(prisma));
    const moduleRef = await Test.createTestingModule({
      controllers: [BoardsController, IssuesController],
      providers: [
        { provide: BoardsService, useValue: boards },
        { provide: IssuesService, useValue: issues },
      ],
    }).compile();

    const fixture = await createFixture();
    userId = fixture.userId;
    projectId = fixture.projectId;
    columnId = fixture.columnId;

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.use((incoming: Request, _response: Response, next: NextFunction) => {
      incoming.user = {
        userId,
        identityId: 'integration-identity',
        email: 'integration@example.com',
        displayName: 'Integration HTTP',
        avatarUrl: null,
      };
      next();
    });
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })
    );
    app.useGlobalFilters(new DomainExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    if (prisma) {
      await cleanupFixtures();
      await prisma.onModuleDestroy();
    }
  });

  it('creates a task and returns it from the Board aggregate', async () => {
    const createResponse = await request(app.getHttpServer())
      .post(`/api/v1/projects/${projectId}/issues`)
      .send({ title: 'HTTP persisted task', columnId })
      .expect(201);

    expect(createResponse.body).toMatchObject({
      title: 'HTTP persisted task',
      columnId,
      version: 1,
    });

    const boardResponse = await request(app.getHttpServer())
      .get(`/api/v1/projects/${projectId}/board`)
      .expect(200);

    expect(boardResponse.body.issues).toContainEqual(
      expect.objectContaining({ id: createResponse.body.id, title: 'HTTP persisted task' })
    );
  });

  it('rejects unknown request fields before the application service runs', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/projects/${projectId}/issues`)
      .send({ title: 'Invalid task', columnId, projectId: 'client-controlled' })
      .expect(400);
  });

  async function createFixture() {
    const user = await prisma.user.create({ data: { displayName: 'Integration HTTP' } });
    const workspace = await prisma.workspace.create({
      data: { ownerId: user.id, name: 'HTTP workspace' },
    });
    const project = await prisma.project.create({
      data: { workspaceId: workspace.id, name: 'HTTP project' },
    });
    const column = await prisma.boardColumn.create({
      data: { projectId: project.id, name: 'To do', rank: 1024n },
    });

    return { userId: user.id, projectId: project.id, columnId: column.id };
  }

  async function cleanupFixtures() {
    const users = await prisma.user.findMany({
      where: { displayName: 'Integration HTTP' },
      select: { id: true },
    });
    const userIds = users.map(({ id }) => id);
    if (!userIds.length) return;

    await prisma.workspace.deleteMany({ where: { ownerId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }
});
