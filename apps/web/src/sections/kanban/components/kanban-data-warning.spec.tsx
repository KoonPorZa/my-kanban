import { it, expect, describe } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import { KanbanDataWarning } from './kanban-data-warning';

describe('KanbanDataWarning', () => {
  it('renders a visible non-blocking warning with the skipped task count', () => {
    const html = renderToStaticMarkup(<KanbanDataWarning skippedIssueCount={2} />);

    expect(html).toContain('Some Board data could not be displayed');
    expect(html).toContain('2 invalid tasks were skipped');
    expect(html).toContain('The rest of the Board is still available');
    expect(html).toContain('aria-live="polite"');
  });

  it('renders nothing when every task record is valid', () => {
    expect(renderToStaticMarkup(<KanbanDataWarning skippedIssueCount={0} />)).toBe('');
  });
});
