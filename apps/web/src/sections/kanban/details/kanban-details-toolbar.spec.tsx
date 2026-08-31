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
          onArchive={vi.fn()}
          onDuplicate={vi.fn()}
          onMoveNext={vi.fn()}
          onMovePrevious={vi.fn()}
          onLikeToggle={vi.fn()}
          onCloseDetails={vi.fn()}
        />
      </ThemeProvider>
    );

    expect(html).toContain('aria-label="Archive task"');
    expect(html).toContain('Archive');
    expect(html).toContain('aria-label="Duplicate task"');
    expect(html).toContain('aria-label="Like task"');
    expect(html).toContain('aria-label="Move task to previous column"');
    expect(html).toContain('aria-label="Move task to next column"');
    expect(html).not.toContain('more-vertical');
    expect(html).not.toContain('Delete task');
    expect(html).not.toContain('Ready to test');
  });
});
