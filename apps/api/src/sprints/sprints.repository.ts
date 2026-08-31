import type { CompleteSprintDto, CreateSprintDto } from './dto/sprint-mutation.dto';
import type { SprintListResponseDto, SprintResponseDto } from './dto/sprint-response.dto';
import type { CreateIssueDto } from '../issues/dto/issue-mutation.dto';
import type { IssueResponseDto } from '../issues/dto/issue-response.dto';

export abstract class SprintsRepository {
  abstract list(ownerId: string, projectId: string): Promise<SprintListResponseDto>;

  abstract create(
    ownerId: string,
    projectId: string,
    input: CreateSprintDto
  ): Promise<SprintResponseDto>;

  abstract addIssue(ownerId: string, sprintId: string, issueId: string): Promise<SprintResponseDto>;

  abstract createIssue(
    ownerId: string,
    sprintId: string,
    input: CreateIssueDto
  ): Promise<IssueResponseDto>;

  abstract removeIssue(
    ownerId: string,
    sprintId: string,
    issueId: string
  ): Promise<SprintResponseDto>;

  abstract start(ownerId: string, sprintId: string, version: number): Promise<SprintResponseDto>;

  abstract complete(
    ownerId: string,
    sprintId: string,
    input: CompleteSprintDto
  ): Promise<SprintResponseDto>;
}
