import type { Request } from '@playwright/test';

import { test, expect } from '@playwright/test';

const projectId = '10000000-0000-4000-8000-000000000001';
const columnId = '20000000-0000-4000-8000-000000000001';
const firstId = '30000000-0000-4000-8000-000000000001';
const secondId = '30000000-0000-4000-8000-000000000002';
const sprintId = '50000000-0000-4000-8000-000000000001';
const timestamp = '2026-09-01T00:00:00.000Z';

test('planning backlog supports drag reorder, keyboard alternatives, and title-only quick-add', async ({
  page,
}) => {
  const moveBodies: Array<Record<string, unknown>> = [];
  const createBodies: Array<Record<string, unknown>> = [];

  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;

    if (pathname === '/api/v1/me') {
      await route.fulfill({
        json: {
          userId: '40000000-0000-4000-8000-000000000001',
          identityId: 'google:test-user',
          email: 'test@example.com',
          displayName: 'Test User',
          avatarUrl: null,
        },
      });
      return;
    }
    if (pathname === '/api/v1/projects') {
      await route.fulfill({
        json: {
          activeProjectId: projectId,
          projects: [
            {
              id: projectId,
              name: 'Scrum planning',
              color: 'primary',
              mode: 'scrum',
              version: 1,
              doneRetentionDays: 30,
            },
          ],
        },
      });
      return;
    }
    if (pathname === `/api/v1/projects/${projectId}/sprints`) {
      await route.fulfill({ json: { sprints: [plannedSprint()] } });
      return;
    }
    if (pathname === `/api/v1/projects/${projectId}/board`) {
      await route.fulfill({
        json: {
          project: { id: projectId, name: 'Scrum planning', mode: 'scrum', version: 1 },
          columns: [
            {
              id: columnId,
              projectId,
              name: 'To do',
              category: 'todo',
              wipLimit: null,
              version: 1,
            },
          ],
          issues: [issue(firstId, 'First backlog task'), issue(secondId, 'Second backlog task')],
        },
      });
      return;
    }
    if (pathname === `/api/v1/issues/${firstId}/move` && request.method() === 'POST') {
      moveBodies.push(await body(request));
      await route.fulfill({ json: { ...issue(firstId, 'First backlog task'), version: 2 } });
      return;
    }
    if (pathname === `/api/v1/projects/${projectId}/issues` && request.method() === 'POST') {
      const requestBody = await body(request);
      createBodies.push(requestBody);
      await route.fulfill({
        status: 201,
        json: issue('30000000-0000-4000-8000-000000000003', String(requestBody.title)),
      });
      return;
    }

    await route.fulfill({ status: 404, json: { message: `Unhandled test route: ${pathname}` } });
  });

  await page.goto('/dashboard/sprints/');
  await expect(page.getByRole('heading', { name: 'Sprints' })).toBeVisible();

  const dragHandle = page.getByRole('button', { name: 'Drag First backlog task within To do' });
  await expect(
    page.getByRole('button', { name: 'Move First backlog task down in To do' })
  ).toBeEnabled();
  const sourceBox = await dragHandle.boundingBox();
  const targetBox = await page
    .getByRole('button', { name: 'Drag Second backlog task within To do' })
    .boundingBox();
  expect(sourceBox).not.toBeNull();
  expect(targetBox).not.toBeNull();
  await page.mouse.move(sourceBox!.x + sourceBox!.width / 2, sourceBox!.y + sourceBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(targetBox!.x + targetBox!.width / 2, targetBox!.y + targetBox!.height / 2, {
    steps: 8,
  });
  await page.mouse.up();

  await expect.poll(() => moveBodies.length).toBe(1);
  expect(moveBodies[0]).toMatchObject({
    targetColumnId: columnId,
    afterIssueId: secondId,
  });

  const quickAdd = page.getByRole('textbox', { name: 'Quick-add backlog task' }).first();
  await quickAdd.fill('Created from planning');
  await quickAdd.press('Enter');
  await expect.poll(() => createBodies.length).toBe(1);
  expect(createBodies[0]).toEqual({ columnId, title: 'Created from planning' });
});

async function body(request: Request) {
  return (await request.postDataJSON()) as Record<string, unknown>;
}

function issue(id: string, title: string) {
  return {
    id,
    projectId,
    sprintId: null,
    columnId,
    title,
    description: '',
    type: 'task',
    priority: 'medium',
    labels: [],
    storyPoints: null,
    dueDate: null,
    isBlocked: false,
    blockedReason: null,
    checklist: [],
    checklistIncompleteCount: 0,
    completedAt: null,
    version: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function plannedSprint() {
  return {
    id: sprintId,
    projectId,
    name: 'Sprint 1',
    goal: '',
    status: 'planned',
    startDate: '2026-09-01',
    endDate: '2026-09-14',
    plannedPoints: 0,
    plannedIssueCount: 0,
    completedPoints: 0,
    completedIssueCount: 0,
    incompletePoints: 0,
    incompleteIssueCount: 0,
    issueCount: 0,
    completedAt: null,
    version: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}
