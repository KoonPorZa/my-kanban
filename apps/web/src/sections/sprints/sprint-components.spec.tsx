import { it, vi, expect, describe } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import { ThemeProvider } from '@mui/material/styles';

import { createTheme } from 'src/theme/create-theme';

import { PlannedSprintCard } from './planned-sprint-card';
import { SprintHistoryList } from './sprint-history-list';

function render(component: React.ReactNode) {
  return renderToStaticMarkup(<ThemeProvider theme={createTheme()}>{component}</ThemeProvider>);
}

describe('Sprint components', () => {
  it('explains why an empty planned Sprint cannot start', () => {
    const html = render(
      <PlannedSprintCard
        name="Sprint 1"
        goal="Ship Scrum MVP"
        startDate="2026-09-01"
        endDate="2026-09-14"
        issueCount={0}
        plannedPoints={0}
        canStart={false}
        onStart={vi.fn()}
      />
    );

    expect(html).toContain('Add at least one issue before starting this sprint.');
    expect(html).toContain('disabled');
    expect(html).toContain('aria-describedby');
  });

  it('renders velocity and incomplete Sprint history metrics', () => {
    const html = render(
      <SprintHistoryList
        sprints={[
          {
            id: 'sprint-1',
            name: 'Sprint 1',
            goal: 'Ship Scrum MVP',
            startDate: '2026-09-01',
            endDate: '2026-09-14',
            completedAt: '2026-09-14T10:00:00.000Z',
            issueCount: 3,
            completedIssueCount: 2,
            incompleteIssueCount: 1,
            plannedPoints: 13,
            completedPoints: 8,
            incompletePoints: 5,
          },
        ]}
      />
    );

    expect(html).toContain('8 / 13 points');
    expect(html).toContain('2 completed');
    expect(html).toContain('1 incomplete');
    expect(html).toContain('5 incomplete points');
  });
});
