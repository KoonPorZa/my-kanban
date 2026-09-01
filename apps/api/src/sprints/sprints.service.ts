import { Injectable } from '@nestjs/common';
import { isUUID } from 'class-validator';

import { DomainValidationError } from '../common/domain/domain-errors';
import type { CreateIssueDto } from '../issues/dto/issue-mutation.dto';
import type { CompleteSprintDto, CreateSprintDto } from './dto/sprint-mutation.dto';
import { assertSprintDateRange } from './sprint-domain';
import { SprintsRepository } from './sprints.repository';

@Injectable()
export class SprintsService {
  constructor(private readonly sprints: SprintsRepository) {}

  list(ownerId: string, projectId: string) {
    return this.sprints.list(ownerId, projectId);
  }

  create(ownerId: string, projectId: string, input: CreateSprintDto) {
    assertSprintDateRange(input.startDate, input.endDate);
    const name = input.name.trim();
    if (!name) throw new DomainValidationError('name must not be empty');
    return this.sprints.create(ownerId, projectId, {
      ...input,
      name,
      goal: input.goal.trim(),
    });
  }

  addIssue(ownerId: string, sprintId: string, issueId: string) {
    return this.sprints.addIssue(ownerId, sprintId, issueId);
  }

  bulkAddIssues(ownerId: string, sprintId: string, issueIds: string[]) {
    if (issueIds.length === 0) throw new DomainValidationError('Select at least one task');
    return this.sprints.bulkAddIssues(ownerId, sprintId, issueIds);
  }

  createIssue(ownerId: string, sprintId: string, input: CreateIssueDto) {
    return this.sprints.createIssue(ownerId, sprintId, input);
  }

  removeIssue(ownerId: string, sprintId: string, issueId: string) {
    return this.sprints.removeIssue(ownerId, sprintId, issueId);
  }

  start(ownerId: string, sprintId: string, version: number) {
    return this.sprints.start(ownerId, sprintId, version);
  }

  complete(ownerId: string, sprintId: string, input: CompleteSprintDto) {
    if (input.incompleteDestination !== 'backlog' && !isUUID(input.incompleteDestination)) {
      throw new DomainValidationError('incompleteDestination must be backlog or a Sprint UUID');
    }
    return this.sprints.complete(ownerId, sprintId, input);
  }
}
