import { DomainValidationError } from '../common/domain/domain-errors';

export type SprintStatus = 'planned' | 'active' | 'completed';

export type SprintIssueForMetrics = {
  storyPoints: number | null;
  isCompleted: boolean;
};

export type SprintMetrics = {
  plannedPoints: number;
  completedPoints: number;
  incompletePoints: number;
  issueCount: number;
  completedIssueCount: number;
  incompleteIssueCount: number;
};

export type IncompleteIssueDestination =
  { type: 'backlog' } | { type: 'sprint'; sprintId: string; status: SprintStatus };

const allowedTransitions: Readonly<Record<SprintStatus, readonly SprintStatus[]>> = {
  planned: ['active'],
  active: ['completed'],
  completed: [],
};

export function assertSprintTransition(current: SprintStatus, next: SprintStatus): void {
  if (!allowedTransitions[current].includes(next)) {
    throw new DomainValidationError(`Sprint cannot transition from ${current} to ${next}`);
  }
}

export function assertSprintDateRange(startDate: Date | string, endDate: Date | string): void {
  const start = toValidDate(startDate, 'startDate');
  const end = toValidDate(endDate, 'endDate');

  if (end.getTime() < start.getTime()) {
    throw new DomainValidationError('endDate must not be before startDate');
  }
}

export function calculateSprintMetrics(issues: readonly SprintIssueForMetrics[]): SprintMetrics {
  return issues.reduce<SprintMetrics>(
    (metrics, issue) => {
      const points = issue.storyPoints ?? 0;
      metrics.plannedPoints += points;
      metrics.issueCount += 1;

      if (issue.isCompleted) {
        metrics.completedPoints += points;
        metrics.completedIssueCount += 1;
      } else {
        metrics.incompletePoints += points;
        metrics.incompleteIssueCount += 1;
      }

      return metrics;
    },
    {
      plannedPoints: 0,
      completedPoints: 0,
      incompletePoints: 0,
      issueCount: 0,
      completedIssueCount: 0,
      incompleteIssueCount: 0,
    }
  );
}

export function assertIncompleteDestination(
  destination: IncompleteIssueDestination,
  currentSprintId: string
): void {
  if (destination.type === 'backlog') return;

  if (!destination.sprintId.trim()) {
    throw new DomainValidationError('Destination sprintId must not be empty');
  }
  if (destination.sprintId === currentSprintId) {
    throw new DomainValidationError('Incomplete issues must move to a different Sprint');
  }
  if (destination.status !== 'planned') {
    throw new DomainValidationError('Incomplete issues can only move to a planned Sprint');
  }
}

function toValidDate(value: Date | string, field: 'startDate' | 'endDate'): Date {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new DomainValidationError(`${field} must be a valid date`);
  }
  return date;
}
