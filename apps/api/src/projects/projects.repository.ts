import type { ProjectListResponseDto } from './dto/project-response.dto';
import type { CreateProjectDto, UpdateProjectDto } from './dto/project-mutation.dto';
import type { ProjectSummaryDto } from './dto/project-response.dto';

export abstract class ProjectsRepository {
  abstract listForOwner(ownerId: string): Promise<ProjectListResponseDto>;

  abstract create(ownerId: string, input: CreateProjectDto): Promise<ProjectSummaryDto>;

  abstract update(
    ownerId: string,
    projectId: string,
    input: UpdateProjectDto
  ): Promise<ProjectSummaryDto>;

  abstract activate(ownerId: string, projectId: string): Promise<ProjectSummaryDto>;

  abstract archive(
    ownerId: string,
    projectId: string,
    version: number
  ): Promise<ProjectListResponseDto>;
}
