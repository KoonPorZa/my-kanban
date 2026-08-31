import { it, vi, expect, describe } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import { createTheme, ThemeProvider } from '@mui/material/styles';

import { KanbanDetailsToolbar } from './kanban-details-toolbar';

describe('KanbanDetailsToolbar', () => {
  it('renders a visible and accessible archive action', () => {
    const html = renderToStaticMarkup(
      <ThemeProvider theme={createTheme({ cssVariables: true })}>
        <KanbanDetailsToolbar
          liked={false}
          taskName="Production smoke task"
          taskStatus="To do"
          onArchive={vi.fn()}
          onLikeToggle={vi.fn()}
          onCloseDetails={vi.fn()}
        />
      </ThemeProvider>
    );

    expect(html).toContain('aria-label="Archive task"');
    expect(html).toContain('Archive');
    expect(html).not.toContain('Delete task');
  });
});
