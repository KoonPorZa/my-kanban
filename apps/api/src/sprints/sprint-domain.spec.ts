import { describe, expect, it } from 'vitest';

import { DomainValidationError } from '../common/domain/domain-errors';
import {
  assertIncompleteDestination,
  assertSprintDateRange,
  assertSprintTransition,
  calculateSprintMetrics,
  type SprintStatus,
} from './sprint-domain';

describe('Sprint transitions', () => {
  it.each([
    ['planned', 'active'],
    ['active', 'completed'],
  ] satisfies [SprintStatus, SprintStatus][])('allows %s to transition to %s', (current, next) => {
    expect(() => assertSprintTransition(current, next)).not.toThrow();
  });

  it.each([
    ['planned', 'planned'],
    ['planned', 'completed'],
    ['active', 'planned'],
    ['active', 'active'],
    ['completed', 'planned'],
    ['completed', 'active'],
    ['completed', 'completed'],
  ] satisfies [SprintStatus, SprintStatus][])('rejects %s to %s', (current, next) => {
    expect(() => assertSprintTransition(current, next)).toThrow(DomainValidationError);
  });
});

describe('Sprint date range', () => {
  it('allows the end date to equal or follow the start date', () => {
    expect(() => assertSprintDateRange('2026-09-01', '2026-09-01')).not.toThrow();
    expect(() =>
      assertSprintDateRange(new Date('2026-09-01'), new Date('2026-09-14'))
    ).not.toThrow();
  });

  it('rejects an end date before the start date', () => {
    expect(() => assertSprintDateRange('2026-09-14', '2026-09-01')).toThrow(
      'endDate must not be before startDate'
    );
  });

  it.each([
    ['invalid', '2026-09-14', 'startDate'],
    ['2026-09-01', 'invalid', 'endDate'],
  ])('rejects an invalid %s value', (startDate, endDate, field) => {
    expect(() => assertSprintDateRange(startDate, endDate)).toThrow(
      `${field} must be a valid date`
    );
  });
});

describe('Sprint metrics', () => {
  it('sums planned, completed, and incomplete points with issue counts', () => {
    expect(
      calculateSprintMetrics([
        { storyPoints: 8, isCompleted: true },
        { storyPoints: 5, isCompleted: false },
        { storyPoints: 3, isCompleted: true },
      ])
    ).toEqual({
      plannedPoints: 16,
      completedPoints: 11,
      incompletePoints: 5,
      issueCount: 3,
      completedIssueCount: 2,
      incompleteIssueCount: 1,
    });
  });

  it('treats null story points as zero without excluding the issue', () => {
    expect(
      calculateSprintMetrics([
        { storyPoints: null, isCompleted: true },
        { storyPoints: null, isCompleted: false },
      ])
    ).toEqual({
      plannedPoints: 0,
      completedPoints: 0,
      incompletePoints: 0,
      issueCount: 2,
      completedIssueCount: 1,
      incompleteIssueCount: 1,
    });
  });

  it('returns zeroed metrics for an empty Sprint', () => {
    expect(calculateSprintMetrics([])).toEqual({
      plannedPoints: 0,
      completedPoints: 0,
      incompletePoints: 0,
      issueCount: 0,
      completedIssueCount: 0,
      incompleteIssueCount: 0,
    });
  });
});

describe('incomplete issue destination', () => {
  it('allows moving incomplete issues to the backlog', () => {
    expect(() => assertIncompleteDestination({ type: 'backlog' }, 'current')).not.toThrow();
  });

  it('allows moving incomplete issues to a different planned Sprint', () => {
    expect(() =>
      assertIncompleteDestination(
        { type: 'sprint', sprintId: 'next', status: 'planned' },
        'current'
      )
    ).not.toThrow();
  });

  it.each<SprintStatus>(['active', 'completed'])(
    'rejects moving incomplete issues to a %s Sprint',
    (status) => {
      expect(() =>
        assertIncompleteDestination({ type: 'sprint', sprintId: 'next', status }, 'current')
      ).toThrow('Incomplete issues can only move to a planned Sprint');
    }
  );

  it('rejects the Sprint being completed as the destination', () => {
    expect(() =>
      assertIncompleteDestination(
        { type: 'sprint', sprintId: 'current', status: 'planned' },
        'current'
      )
    ).toThrow('Incomplete issues must move to a different Sprint');
  });

  it('rejects an empty destination Sprint id', () => {
    expect(() =>
      assertIncompleteDestination({ type: 'sprint', sprintId: '  ', status: 'planned' }, 'current')
    ).toThrow('Destination sprintId must not be empty');
  });
});
