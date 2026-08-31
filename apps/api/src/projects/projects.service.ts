import { Injectable } from '@nestjs/common';

import { ProjectsRepository } from './projects.repository';
import type { UpdateProjectModeDto } from './dto/project-mutation.dto';

@Injectable()
export class ProjectsService {
  constructor(private readonly projects: ProjectsRepository) {}

  listForOwner(ownerId: string) {
    return this.projects.listForOwner(ownerId);
  }

  updateMode(ownerId: string, projectId: string, input: UpdateProjectModeDto) {
    return this.projects.updateMode(ownerId, projectId, input);
  }
}
