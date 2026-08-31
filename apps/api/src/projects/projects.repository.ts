import type { ProjectListResponseDto } from './dto/project-response.dto';

export abstract class ProjectsRepository {
  abstract listForOwner(ownerId: string): Promise<ProjectListResponseDto>;
}
