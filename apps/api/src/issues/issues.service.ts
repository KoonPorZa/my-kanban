import { Injectable } from '@nestjs/common';

import { DomainValidationError } from '../common/domain/domain-errors';
import { IssuesRepository } from './issues.repository';
import type { MoveIssueDto, CreateIssueDto, UpdateIssueDto } from './dto/issue-mutation.dto';
import type { TaskListFilter } from './issues.repository';

@Injectable()
export class IssuesService {
  constructor(private readonly issues: IssuesRepository) {}

  create(ownerId: string, projectId: string, input: CreateIssueDto) {
    this.validateBlockedState(input.isBlocked ?? false, input.blockedReason);
    return this.issues.create(ownerId, projectId, {
      ...input,
      title: input.title.trim(),
      labels: this.normalizeLabels(input.labels),
      checklist: this.normalizeChecklist(input.checklist),
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
      checklist: this.normalizeChecklist(input.checklist),
    });
  }

  move(ownerId: string, issueId: string, input: MoveIssueDto) {
    return this.issues.move(ownerId, issueId, input);
  }

  archive(ownerId: string, issueId: string, version: number) {
    return this.issues.archive(ownerId, issueId, version);
  }

  duplicate(ownerId: string, issueId: string, version: number, targetColumnId?: string) {
    return this.issues.duplicate(ownerId, issueId, version, targetColumnId);
  }

  restore(
    ownerId: string,
    issueId: string,
    version: number,
    targetColumnId?: string,
    beforeIssueId?: string,
    afterIssueId?: string
  ) {
    return this.issues.restore(
      ownerId,
      issueId,
      version,
      targetColumnId,
      beforeIssueId,
      afterIssueId
    );
  }

  getForProject(projectId: string, issueId: string, includeArchived = false) {
    return this.issues.getForProject(projectId, issueId, includeArchived);
  }

  listForProject(projectId: string, filter: TaskListFilter) {
    return this.issues.listForProject(projectId, {
      ...filter,
      pageSize: Math.min(Math.max(filter.pageSize ?? 50, 1), 100),
    });
  }

  async createForProject(ownerId: string, projectId: string, input: CreateIssueDto) {
    return this.create(ownerId, projectId, input);
  }

  async createManyForProject(ownerId: string, projectId: string, inputs: CreateIssueDto[]) {
    if (inputs.length < 1 || inputs.length > 10) {
      throw new DomainValidationError('create_tasks accepts between 1 and 10 tasks');
    }
    const normalized = inputs.map((input) => this.normalizeCreateInput(input));
    return this.issues.createMany(ownerId, projectId, normalized);
  }

  async updateForProject(
    ownerId: string,
    projectId: string,
    issueId: string,
    input: UpdateIssueDto
  ) {
    await this.issues.getForProject(projectId, issueId);
    return this.update(ownerId, issueId, input);
  }

  async moveForProject(ownerId: string, projectId: string, issueId: string, input: MoveIssueDto) {
    await this.issues.getForProject(projectId, issueId);
    return this.move(ownerId, issueId, input);
  }

  async archiveForProject(ownerId: string, projectId: string, issueId: string, version: number) {
    await this.issues.getForProject(projectId, issueId);
    return this.archive(ownerId, issueId, version);
  }

  restoreForProject(
    projectId: string,
    issueId: string,
    version: number,
    targetColumnId?: string,
    beforeIssueId?: string,
    afterIssueId?: string
  ) {
    return this.issues.restoreForProject(
      projectId,
      issueId,
      version,
      targetColumnId,
      beforeIssueId,
      afterIssueId
    );
  }

  private normalizeLabels(labels: string[] | undefined) {
    if (!labels) return undefined;
    return [...new Set(labels.map((label) => label.trim()).filter(Boolean))];
  }

  private normalizeCreateInput(input: CreateIssueDto) {
    this.validateBlockedState(input.isBlocked ?? false, input.blockedReason);
    const title = input.title.trim();
    if (!title) throw new DomainValidationError('title must not be empty');
    return {
      ...input,
      title,
      labels: this.normalizeLabels(input.labels),
      checklist: this.normalizeChecklist(input.checklist),
    };
  }

  private normalizeChecklist(checklist: CreateIssueDto['checklist']) {
    if (!checklist) return undefined;
    const ids = checklist.flatMap(({ id }) => (id ? [id] : []));
    if (new Set(ids).size !== ids.length) {
      throw new DomainValidationError('checklist item ids must be unique');
    }
    return checklist.map((item) => {
      const title = item.title.trim();
      if (!title) throw new DomainValidationError('checklist item title must not be empty');
      return { ...item, title, isCompleted: item.isCompleted ?? false };
    });
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
