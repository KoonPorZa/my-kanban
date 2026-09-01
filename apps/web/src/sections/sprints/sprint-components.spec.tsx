import { it, vi, expect, describe } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import { ThemeProvider } from '@mui/material/styles';

import { createTheme } from 'src/theme/create-theme';

import { PlanningPanel } from './sprints-view';
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

  it('renders selectable backlog tasks with an atomic bulk action', () => {
    const html = render(
      <PlanningPanel
        sprint={{
          id: '00000000-0000-4000-8000-000000000001',
          projectId: '00000000-0000-4000-8000-000000000002',
          name: 'Sprint 1',
          goal: '',
          status: 'planned',
          startDate: '2026-09-01',
          endDate: '2026-09-14',
          plannedPoints: 0,
          plannedIssueCount: 0,
          completedPoints: 0,
          completedIssueCount: 0,
          incompletePoints: 0,
          incompleteIssueCount: 0,
          issueCount: 0,
          completedAt: null,
          version: 1,
          createdAt: '2026-09-01T00:00:00.000Z',
          updatedAt: '2026-09-01T00:00:00.000Z',
        }}
        columns={[{ id: 'column-1', name: 'To do' }]}
        backlogIssues={[
          {
            id: 'issue-1',
            title: 'Selectable task',
            storyPoints: 3,
            columnId: 'column-1',
            version: 1,
          },
        ]}
        assignedIssues={[]}
        busy={false}
        onAdd={vi.fn()}
        onBulkAdd={vi.fn(async () => true)}
        onRemove={vi.fn()}
        onCreateBacklog={vi.fn(async () => undefined)}
        onReorderBacklog={vi.fn(async () => undefined)}
      />
    );

    expect(html).toContain('Select Selectable task');
    expect(html).toContain('Add selected (0)');
    expect(html).toContain('Quick-add backlog task');
    expect(html).toContain('Drag Selectable task within To do');
  });
});
