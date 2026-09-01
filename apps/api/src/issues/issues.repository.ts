import type { MoveIssueDto, CreateIssueDto, UpdateIssueDto } from './dto/issue-mutation.dto';
import type { IssueResponseDto } from './dto/issue-response.dto';

export type TaskArchiveFilter = 'active' | 'archived' | 'all';

export type TaskListFilter = {
  columnId?: string;
  priority?: string;
  archived?: TaskArchiveFilter;
  query?: string;
  cursor?: string;
  pageSize?: number;
};

export type TaskListResult = {
  tasks: IssueResponseDto[];
  nextCursor: string | null;
};

export abstract class IssuesRepository {
  abstract create(
    ownerId: string,
    projectId: string,
    input: CreateIssueDto
  ): Promise<IssueResponseDto>;

  abstract update(
    ownerId: string,
    issueId: string,
    input: UpdateIssueDto
  ): Promise<IssueResponseDto>;

  abstract move(ownerId: string, issueId: string, input: MoveIssueDto): Promise<IssueResponseDto>;

  abstract archive(ownerId: string, issueId: string, version: number): Promise<IssueResponseDto>;

  abstract duplicate(
    ownerId: string,
    issueId: string,
    version: number,
    targetColumnId?: string
  ): Promise<IssueResponseDto>;

  abstract restore(
    ownerId: string,
    issueId: string,
    version: number,
    targetColumnId?: string,
    beforeIssueId?: string,
    afterIssueId?: string
  ): Promise<IssueResponseDto>;

  abstract getForProject(
    projectId: string,
    issueId: string,
    includeArchived?: boolean
  ): Promise<IssueResponseDto>;

  abstract listForProject(projectId: string, filter: TaskListFilter): Promise<TaskListResult>;

  abstract createMany(
    ownerId: string,
    projectId: string,
    inputs: CreateIssueDto[]
  ): Promise<IssueResponseDto[]>;

  abstract restoreForProject(
    projectId: string,
    issueId: string,
    version: number,
    targetColumnId?: string,
    beforeIssueId?: string,
    afterIssueId?: string
  ): Promise<IssueResponseDto>;
}
