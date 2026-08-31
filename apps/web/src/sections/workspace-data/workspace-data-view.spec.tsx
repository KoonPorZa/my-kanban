import { it, expect, describe } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import { ImportPreviewSummary } from './workspace-data-view';

describe('ImportPreviewSummary', () => {
  it('shows validated entity counts and replace impact before confirmation', () => {
    const html = renderToStaticMarkup(
      <ImportPreviewSummary
        preview={{
          mode: 'replace',
          schemaVersion: 1,
          exportedAt: '2026-09-01T00:00:00.000Z',
          workspaceName: 'Personal',
          counts: { projects: 2, columns: 8, sprints: 1, issues: 12, checklistItems: 4 },
          impact: { newProjects: 1, matchingProjects: 1, projectsToArchive: 3 },
        }}
      />
    );

    expect(html).toContain('Validated schema v1');
    expect(html).toContain('Workspace: Personal');
    expect(html).toContain('12');
    expect(html).toContain('Tasks');
    expect(html).toContain('3 destination-only Projects will be archived');
  });
});
