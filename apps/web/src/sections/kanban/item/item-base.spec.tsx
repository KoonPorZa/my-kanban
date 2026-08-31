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
  description: '',
  attachments: [],
  comments: [],
  assignee: [],
  due: [null, null],
  reporter: { id: '', name: '', avatarUrl: '' },
};

function renderTask(storyPoints: number | null) {
  return renderToStaticMarkup(
    <ThemeProvider theme={createTheme()}>
      <ItemBase task={{ ...task, storyPoints }} />
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
});
