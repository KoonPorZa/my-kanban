import type { MoveIssueDto, CreateIssueDto, UpdateIssueDto } from './dto/issue-mutation.dto';
import type { IssueResponseDto } from './dto/issue-response.dto';

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
}
