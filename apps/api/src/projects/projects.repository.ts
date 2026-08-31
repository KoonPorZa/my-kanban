import type { ProjectListResponseDto } from './dto/project-response.dto';
import type { UpdateProjectModeDto } from './dto/project-mutation.dto';
import type { ProjectSummaryDto } from './dto/project-response.dto';

export abstract class ProjectsRepository {
  abstract listForOwner(ownerId: string): Promise<ProjectListResponseDto>;

  abstract updateMode(
    ownerId: string,
    projectId: string,
    input: UpdateProjectModeDto
  ): Promise<ProjectSummaryDto>;
}
