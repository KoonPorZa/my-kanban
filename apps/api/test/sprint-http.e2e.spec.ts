import type { NextFunction, Request, Response } from 'express';
import type { INestApplication } from '@nestjs/common';

import request from 'supertest';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ValidationPipe, VersioningType } from '@nestjs/common';

import { DomainExceptionFilter } from '../src/common/http/domain-exception.filter';
import { PrismaService } from '../src/database/prisma.service';
import { CreateIssueDto } from '../src/issues/dto/issue-mutation.dto';
import { CreateSprintDto } from '../src/sprints/dto/sprint-mutation.dto';
import { BulkSprintIssuesDto } from '../src/sprints/dto/sprint-mutation.dto';
import { PrismaSprintsRepository } from '../src/sprints/prisma-sprints.repository';
import { SprintsController } from '../src/sprints/sprints.controller';
import { SprintsService } from '../src/sprints/sprints.service';

describe('Sprint HTTP API', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let userId: string;
  let projectId: string;
  let todoColumnId: string;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.onModuleInit();
    await cleanupFixtures();
    Reflect.defineMetadata(
      'design:paramtypes',
      [Object, String, CreateSprintDto],
      SprintsController.prototype,
      'create'
    );
    Reflect.defineMetadata(
      'design:paramtypes',
      [Object, String, CreateIssueDto],
      SprintsController.prototype,
      'createIssue'
    );
    Reflect.defineMetadata(
      'design:paramtypes',
      [Object, String, BulkSprintIssuesDto],
      SprintsController.prototype,
      'bulkAddIssues'
    );
    const sprints = new SprintsService(new PrismaSprintsRepository(prisma));
    const moduleRef = await Test.createTestingModule({
      controllers: [SprintsController],
      providers: [{ provide: SprintsService, useValue: sprints }],
    }).compile();
    const fixture = await createFixture();
    userId = fixture.userId;
    projectId = fixture.projectId;
    todoColumnId = fixture.todoColumnId;

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.use((incoming: Request, _response: Response, next: NextFunction) => {
      incoming.user = {
        userId,
        identityId: 'sprint-http-identity',
        email: 'sprint-http@example.com',
        displayName: 'Integration Sprint HTTP',
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

  it('creates and lists a Sprint through the versioned API', async () => {
    const created = await request(app.getHttpServer())
      .post(`/api/v1/projects/${projectId}/sprints`)
      .send({
        name: 'HTTP Sprint',
        goal: 'Validate the endpoint',
        startDate: '2026-09-01',
        endDate: '2026-09-14',
      })
      .expect(201);
    expect(created.body).toMatchObject({ name: 'HTTP Sprint', status: 'planned', issueCount: 0 });

    const listed = await request(app.getHttpServer())
      .get(`/api/v1/projects/${projectId}/sprints`)
      .expect(200);
    expect(listed.body.sprints).toContainEqual(expect.objectContaining({ id: created.body.id }));
  });

  it('rejects an invalid date range and unknown input fields', async () => {
    await request(app.getHttpServer()).get('/api/v1/projects/not-a-uuid/sprints').expect(400);

    await request(app.getHttpServer())
      .post(`/api/v1/projects/${projectId}/sprints`)
      .send({
        name: 'Invalid Sprint',
        startDate: '2026-09-14',
        endDate: '2026-09-01',
      })
      .expect(400);

    await request(app.getHttpServer())
      .post(`/api/v1/projects/${projectId}/sprints`)
      .send({
        name: 'Unknown field',
        startDate: '2026-09-01',
        endDate: '2026-09-14',
        projectId: 'client-controlled',
      })
      .expect(400);
  });

  it('creates a task directly in a Sprint through one atomic endpoint', async () => {
    const sprint = await request(app.getHttpServer())
      .post(`/api/v1/projects/${projectId}/sprints`)
      .send({
        name: 'Quick add Sprint',
        startDate: '2026-10-01',
        endDate: '2026-10-14',
      })
      .expect(201);

    const created = await request(app.getHttpServer())
      .post(`/api/v1/sprints/${sprint.body.id}/issues/create`)
      .send({ title: 'Atomic quick add', columnId: todoColumnId, storyPoints: 3 })
      .expect(201);
    expect(created.body).toMatchObject({
      projectId,
      sprintId: sprint.body.id,
      columnId: todoColumnId,
      title: 'Atomic quick add',
      storyPoints: 3,
    });
  });

  it('assigns multiple tasks through the bulk Sprint endpoint', async () => {
    const sprint = await request(app.getHttpServer())
      .post(`/api/v1/projects/${projectId}/sprints`)
      .send({ name: 'Bulk HTTP Sprint', startDate: '2026-11-01', endDate: '2026-11-14' })
      .expect(201);
    const tasks = await Promise.all([
      prisma.issue.create({
        data: { projectId, columnId: todoColumnId, title: 'Bulk one', rank: 4096n },
      }),
      prisma.issue.create({
        data: { projectId, columnId: todoColumnId, title: 'Bulk two', rank: 5120n },
      }),
    ]);

    const assigned = await request(app.getHttpServer())
      .post(`/api/v1/sprints/${sprint.body.id}/issues/bulk`)
      .send({ issueIds: tasks.map(({ id }) => id) })
      .expect(200);
    expect(assigned.body.issueCount).toBe(2);

    await request(app.getHttpServer())
      .post(`/api/v1/sprints/${sprint.body.id}/issues/bulk`)
      .send({ issueIds: [] })
      .expect(400);
  });

  async function createFixture() {
    const user = await prisma.user.create({ data: { displayName: 'Integration Sprint HTTP' } });
    const workspace = await prisma.workspace.create({
      data: { ownerId: user.id, name: 'Sprint HTTP workspace' },
    });
    const project = await prisma.project.create({
      data: { workspaceId: workspace.id, name: 'Sprint HTTP project', mode: 'scrum' },
    });
    const todoColumn = await prisma.boardColumn.create({
      data: { projectId: project.id, name: 'To do', category: 'todo', rank: 1024n },
    });
    return { userId: user.id, projectId: project.id, todoColumnId: todoColumn.id };
  }

  async function cleanupFixtures() {
    const users = await prisma.user.findMany({
      where: { displayName: 'Integration Sprint HTTP' },
      select: { id: true },
    });
    const userIds = users.map(({ id }) => id);
    if (!userIds.length) return;
    await prisma.workspace.deleteMany({ where: { ownerId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }
});
