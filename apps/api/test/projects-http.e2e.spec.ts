import type { NextFunction, Request, Response } from 'express';
import type { INestApplication } from '@nestjs/common';

import request from 'supertest';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ValidationPipe, VersioningType } from '@nestjs/common';

import { PrismaService } from '../src/database/prisma.service';
import { ProjectsService } from '../src/projects/projects.service';
import { ProjectsController } from '../src/projects/projects.controller';
import { PrismaProjectsRepository } from '../src/projects/prisma-projects.repository';
import {
  CreateProjectDto,
  UpdateProjectDto,
  VersionedProjectCommandDto,
} from '../src/projects/dto/project-mutation.dto';
import { DomainExceptionFilter } from '../src/common/http/domain-exception.filter';
import { DomainConflictError } from '../src/common/domain/domain-errors';

describe('Projects HTTP API', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let userId: string;
  let workspaceId: string;
  let originalProjectId: string;
  let originalColumnId: string;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.onModuleInit();
    await cleanupFixtures();

    Reflect.defineMetadata(
      'design:paramtypes',
      [Object, CreateProjectDto],
      ProjectsController.prototype,
      'create'
    );
    Reflect.defineMetadata(
      'design:paramtypes',
      [Object, String, UpdateProjectDto],
      ProjectsController.prototype,
      'update'
    );
    Reflect.defineMetadata(
      'design:paramtypes',
      [Object, String, VersionedProjectCommandDto],
      ProjectsController.prototype,
      'archive'
    );

    const projects = new ProjectsService(new PrismaProjectsRepository(prisma));
    const moduleRef = await Test.createTestingModule({
      controllers: [ProjectsController],
      providers: [{ provide: ProjectsService, useValue: projects }],
    }).compile();

    const fixture = await createFixture();
    userId = fixture.userId;
    workspaceId = fixture.workspaceId;
    originalProjectId = fixture.projectId;
    originalColumnId = fixture.columnId;

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.use((incoming: Request, _response: Response, next: NextFunction) => {
      incoming.user = {
        userId,
        identityId: 'project-integration-identity',
        email: 'projects@example.com',
        displayName: 'Projects HTTP integration',
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

  it('creates and activates a project with the exact default workflow', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/projects')
      .send({ name: ' Product delivery ', color: 'info', mode: 'scrum' })
      .expect(201);

    expect(response.body).toMatchObject({
      name: 'Product delivery',
      color: 'info',
      mode: 'scrum',
      version: 1,
      doneRetentionDays: 30,
    });

    const columns = await prisma.boardColumn.findMany({
      where: { projectId: response.body.id },
      orderBy: { rank: 'asc' },
      select: { name: true, category: true, rank: true },
    });
    expect(columns).toEqual([
      { name: 'To do', category: 'todo', rank: 1024n },
      { name: 'In progress', category: 'in_progress', rank: 2048n },
      { name: 'Review', category: 'in_progress', rank: 3072n },
      { name: 'Done', category: 'done', rank: 4096n },
    ]);
    await expect(
      prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } })
    ).resolves.toMatchObject({ activeProjectId: response.body.id });
  });

  it('partially updates project settings with optimistic concurrency', async () => {
    const list = await request(app.getHttpServer()).get('/api/v1/projects').expect(200);
    const active = list.body.projects.find(
      (project: { id: string }) => project.id === list.body.activeProjectId
    );

    const updated = await request(app.getHttpServer())
      .patch(`/api/v1/projects/${active.id}`)
      .send({
        version: active.version,
        name: 'Delivery board',
        color: 'warning',
        doneRetentionDays: 14,
      })
      .expect(200);
    expect(updated.body).toMatchObject({
      name: 'Delivery board',
      color: 'warning',
      mode: 'scrum',
      doneRetentionDays: 14,
      version: active.version + 1,
    });

    await request(app.getHttpServer())
      .patch(`/api/v1/projects/${active.id}`)
      .send({ version: active.version, name: 'Stale name' })
      .expect(409);
    await request(app.getHttpServer())
      .patch(`/api/v1/projects/${active.id}`)
      .send({ version: updated.body.version, doneRetentionDays: 21 })
      .expect(400);
  });

  it('activates and soft-archives a project with a fallback without deleting children', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/projects/${originalProjectId}/activate`)
      .expect(200);

    const archived = await request(app.getHttpServer())
      .post(`/api/v1/projects/${originalProjectId}/archive`)
      .send({ version: 1 })
      .expect(200);

    expect(archived.body.activeProjectId).not.toBe(originalProjectId);
    expect(archived.body.projects).not.toContainEqual(
      expect.objectContaining({ id: originalProjectId })
    );
    await expect(
      prisma.project.findUniqueOrThrow({ where: { id: originalProjectId } })
    ).resolves.toMatchObject({ archivedAt: expect.any(Date) });
    await expect(
      prisma.boardColumn.findUniqueOrThrow({ where: { id: originalColumnId } })
    ).resolves.toMatchObject({ projectId: originalProjectId, archivedAt: null });
  });

  it('rejects archiving the final active Project', async () => {
    const fixture = await createFixture();
    const repository = new PrismaProjectsRepository(prisma);

    await expect(repository.archive(fixture.userId, fixture.projectId, 1)).rejects.toBeInstanceOf(
      DomainConflictError
    );
    await expect(
      prisma.project.findUniqueOrThrow({ where: { id: fixture.projectId } })
    ).resolves.toMatchObject({ archivedAt: null, version: 1 });
  });

  it('serializes concurrent archives so one active Project always remains', async () => {
    const fixture = await createFixture();
    const repository = new PrismaProjectsRepository(prisma);
    const second = await repository.create(fixture.userId, { name: 'Concurrent fallback' });

    const results = await Promise.allSettled([
      repository.archive(fixture.userId, fixture.projectId, 1),
      repository.archive(fixture.userId, second.id, second.version),
    ]);

    expect(results.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);
    expect(results.filter(({ status }) => status === 'rejected')).toHaveLength(1);
    expect(results.find(({ status }) => status === 'rejected')).toMatchObject({
      reason: expect.any(DomainConflictError),
    });
    await expect(
      prisma.project.count({ where: { workspaceId: fixture.workspaceId, archivedAt: null } })
    ).resolves.toBe(1);
  });

  async function createFixture() {
    const user = await prisma.user.create({
      data: { displayName: 'Projects HTTP integration' },
    });
    const workspace = await prisma.workspace.create({
      data: { ownerId: user.id, name: 'Projects HTTP workspace' },
    });
    const project = await prisma.project.create({
      data: { workspaceId: workspace.id, name: 'Original project' },
    });
    const column = await prisma.boardColumn.create({
      data: { projectId: project.id, name: 'To do', rank: 1024n },
    });
    await prisma.workspace.update({
      where: { id: workspace.id },
      data: { activeProjectId: project.id },
    });
    return {
      userId: user.id,
      workspaceId: workspace.id,
      projectId: project.id,
      columnId: column.id,
    };
  }

  async function cleanupFixtures() {
    const users = await prisma.user.findMany({
      where: { displayName: 'Projects HTTP integration' },
      select: { id: true },
    });
    const userIds = users.map(({ id }) => id);
    if (!userIds.length) return;
    await prisma.workspace.deleteMany({ where: { ownerId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }
});
