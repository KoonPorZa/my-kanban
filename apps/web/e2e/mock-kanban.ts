import type { Page, Request } from '@playwright/test';

export type MockKanbanApi = {
  moveRequests: Array<Record<string, unknown>>;
};

const MOVE_RESPONSE_DELAY_MS = 300;

const projectId = '10000000-0000-4000-8000-000000000001';
const todoId = '20000000-0000-4000-8000-000000000001';
const doingId = '20000000-0000-4000-8000-000000000002';
const doneId = '20000000-0000-4000-8000-000000000003';
const taskId = '30000000-0000-4000-8000-000000000001';
const timestamp = '2026-09-01T00:00:00.000Z';

const columns = [
  {
    id: todoId,
    projectId,
    name: 'Todo',
    category: 'todo',
    wipLimit: null,
    version: 1,
  },
  {
    id: doingId,
    projectId,
    name: 'Doing',
    category: 'in_progress',
    wipLimit: 2,
    version: 1,
  },
  {
    id: doneId,
    projectId,
    name: 'Done',
    category: 'done',
    wipLimit: null,
    version: 1,
  },
] as const;

const issue = {
  id: taskId,
  projectId,
  sprintId: null,
  columnId: todoId,
  title: 'Keyboard card',
  description: 'A deterministic browser-test task',
  type: 'task',
  priority: 'medium',
  labels: ['quality'],
  storyPoints: 3,
  dueDate: null,
  isBlocked: false,
  blockedReason: null,
  checklist: [
    { id: '50000000-0000-4000-8000-000000000001', title: 'First check', isCompleted: true },
    { id: '50000000-0000-4000-8000-000000000002', title: 'Second check', isCompleted: false },
  ],
  checklistIncompleteCount: 1,
  completedAt: null,
  version: 1,
  createdAt: timestamp,
  updatedAt: timestamp,
};

async function json(request: Request) {
  return (await request.postDataJSON()) as Record<string, unknown>;
}

export async function installMockKanbanApi(page: Page): Promise<MockKanbanApi> {
  const moveRequests: Array<Record<string, unknown>> = [];

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
              name: 'Quality Board',
              color: 'primary',
              mode: 'kanban',
              version: 1,
              doneRetentionDays: 30,
            },
          ],
        },
      });
      return;
    }

    if (pathname === `/api/v1/projects/${projectId}/board`) {
      await route.fulfill({
        json: {
          project: { id: projectId, name: 'Quality Board', mode: 'kanban', version: 1 },
          columns,
          issues: [issue],
        },
      });
      return;
    }

    if (pathname === `/api/v1/issues/${taskId}/move` && request.method() === 'POST') {
      const body = await json(request);
      moveRequests.push(body);
      await new Promise((resolve) => setTimeout(resolve, MOVE_RESPONSE_DELAY_MS));
      await route.fulfill({
        json: {
          ...issue,
          columnId: body.targetColumnId,
          version: issue.version + 1,
          updatedAt: '2026-09-01T00:01:00.000Z',
        },
      });
      return;
    }

    await route.fulfill({ status: 404, json: { message: `Unhandled test route: ${pathname}` } });
  });

  return { moveRequests };
}
