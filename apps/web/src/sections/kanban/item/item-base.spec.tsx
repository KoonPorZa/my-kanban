import type { IKanbanTask } from 'src/types/kanban';

import { it, expect, describe } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import { ThemeProvider } from '@mui/material/styles';

import { createTheme } from 'src/theme/create-theme';

import ItemBase from './item-base';

const task: IKanbanTask = {
  id: 'task-1',
  name: 'Estimate Sprint work',
  status: 'To do',
  priority: 'medium',
  labels: [],
  version: 1,
  sprintId: 'sprint-1',
  storyPoints: 0,
  type: 'task',
  dueDate: null,
  isBlocked: false,
  blockedReason: null,
  checklist: [],
  checklistIncompleteCount: 0,
  completedAt: null,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
  description: '',
  attachments: [],
  comments: [],
  assignee: [],
  due: [null, null],
  reporter: { id: '', name: '', avatarUrl: '' },
};

function renderTask(storyPoints: number | null, withMoveActions = false) {
  return renderToStaticMarkup(
    <ThemeProvider theme={createTheme()}>
      <ItemBase
        task={{ ...task, storyPoints }}
        onMovePrevious={withMoveActions ? () => undefined : undefined}
        onMoveNext={withMoveActions ? () => undefined : undefined}
      />
    </ThemeProvider>
  );
}

describe('ItemBase Story Points badge', () => {
  it('shows an accessible badge for an estimated task, including zero', () => {
    const html = renderTask(0);

    expect(html).toContain('aria-label="0 story points"');
    expect(html).toContain('0 pts');
  });

  it('does not show a badge for an unestimated task', () => {
    expect(renderTask(null)).not.toContain('story points');
  });

  it('exposes an accessible task-details control', () => {
    const html = renderTask(0);
    expect(html).toContain('role="button"');
    expect(html).toContain('aria-label="Open task Estimate Sprint work"');
  });

  it('renders column move actions as a sibling action group', () => {
    const html = renderTask(0, true);
    expect(html).toContain('aria-label="Move task between columns"');
    expect(html).toContain('aria-label="Move task to previous column"');
    expect(html).toContain('aria-label="Move task to next column"');
  });
});
