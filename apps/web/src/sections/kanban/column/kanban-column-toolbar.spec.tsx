import { it, vi, expect, describe } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import { ThemeProvider } from '@mui/material/styles';

import { createTheme } from 'src/theme/create-theme';

import { submitColumnArchive, KanbanColumnToolBar } from './kanban-column-toolbar';

describe('KanbanColumnToolBar', () => {
  it('shows task, point, WIP, and over-limit totals', () => {
    const html = renderToStaticMarkup(
      <ThemeProvider theme={createTheme()}>
        <KanbanColumnToolBar
          columnName="In progress"
          category="in_progress"
          totalTasks={4}
          totalPoints={8}
          wipLimit={2}
        />
      </ThemeProvider>
    );

    expect(html).toContain('8 pts');
    expect(html).toContain('4/2 WIP');
    expect(html).toContain('Over limit');
  });

  it('does not submit a Done archive when the checklist confirmation is cancelled', () => {
    const onArchiveColumn = vi.fn();
    const confirm = vi.fn(() => false);

    expect(
      submitColumnArchive({
        archiveOptions: [{ id: 'done', name: 'Done', category: 'done' }],
        destinationColumnId: 'done',
        incompleteChecklistCount: 2,
        onArchiveColumn,
        confirm,
      })
    ).toBe(false);
    expect(confirm).toHaveBeenCalledOnce();
    expect(onArchiveColumn).not.toHaveBeenCalled();
  });

  it('submits the explicit checklist override after confirmation', () => {
    const onArchiveColumn = vi.fn();

    expect(
      submitColumnArchive({
        archiveOptions: [{ id: 'done', name: 'Done', category: 'done' }],
        destinationColumnId: 'done',
        incompleteChecklistCount: 2,
        onArchiveColumn,
        confirm: () => true,
      })
    ).toBe(true);
    expect(onArchiveColumn).toHaveBeenCalledWith('done', true);
  });
});
