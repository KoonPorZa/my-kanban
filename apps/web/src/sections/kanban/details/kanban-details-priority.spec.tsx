import { vi, it, expect, describe } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import { ThemeProvider } from '@mui/material/styles';

import { createTheme } from 'src/theme/create-theme';

import { KanbanDetailsPriority } from './kanban-details-priority';

vi.mock('minimal-shared/utils', async (importOriginal) => ({
  ...((await importOriginal()) as object),
  varAlpha: () => 'rgba(0, 0, 0, 0.24)',
}));

describe('KanbanDetailsPriority', () => {
  it('renders named priority actions with 44px minimum targets', () => {
    const html = renderToStaticMarkup(
      <ThemeProvider theme={createTheme()}>
        <KanbanDetailsPriority priority="medium" onChangePriority={vi.fn()} />
      </ThemeProvider>
    );

    expect(html).toContain('min-width:44px');
    expect(html).toContain('min-height:44px');
    expect(html).toContain('>urgent</button>');
    expect(html).toContain('>high</button>');
    expect(html).toContain('>medium</button>');
    expect(html).toContain('>low</button>');
    expect(html).toContain('>none</button>');
  });
});
