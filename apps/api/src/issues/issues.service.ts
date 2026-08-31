import { Injectable } from '@nestjs/common';

import { DomainValidationError } from '../common/domain/domain-errors';
import { IssuesRepository } from './issues.repository';
import type { MoveIssueDto, CreateIssueDto, UpdateIssueDto } from './dto/issue-mutation.dto';

@Injectable()
export class IssuesService {
  constructor(private readonly issues: IssuesRepository) {}

  create(ownerId: string, projectId: string, input: CreateIssueDto) {
    this.validateBlockedState(input.isBlocked ?? false, input.blockedReason);
    return this.issues.create(ownerId, projectId, {
      ...input,
      title: input.title.trim(),
      labels: this.normalizeLabels(input.labels),
    });
  }

  update(ownerId: string, issueId: string, input: UpdateIssueDto) {
    const meaningfulChanges = Object.entries(input).some(
      ([field, value]) => field !== 'version' && value !== undefined
    );
    if (!meaningfulChanges) throw new DomainValidationError('At least one field must change');
    if (input.title !== undefined && !input.title.trim()) {
      throw new DomainValidationError('title must not be empty');
    }
    if (input.isBlocked !== undefined || input.blockedReason !== undefined) {
      this.validateBlockedState(input.isBlocked, input.blockedReason);
    }

    return this.issues.update(ownerId, issueId, {
      ...input,
      title: input.title?.trim(),
      labels: this.normalizeLabels(input.labels),
    });
  }

  move(ownerId: string, issueId: string, input: MoveIssueDto) {
    return this.issues.move(ownerId, issueId, input);
  }

  archive(ownerId: string, issueId: string, version: number) {
    return this.issues.archive(ownerId, issueId, version);
  }

  private normalizeLabels(labels: string[] | undefined) {
    if (!labels) return undefined;
    return [...new Set(labels.map((label) => label.trim()).filter(Boolean))];
  }

  private validateBlockedState(isBlocked: boolean | undefined, blockedReason?: string | null) {
    if (isBlocked && !blockedReason?.trim()) {
      throw new DomainValidationError('blockedReason is required when a task is blocked');
    }
    if (isBlocked === false && blockedReason) {
      throw new DomainValidationError('blockedReason must be empty when a task is not blocked');
    }
  }
}
