import { Injectable } from '@nestjs/common';

import { ProjectsRepository } from './projects.repository';
import type { CreateProjectDto, UpdateProjectDto } from './dto/project-mutation.dto';

@Injectable()
export class ProjectsService {
  constructor(private readonly projects: ProjectsRepository) {}

  listForOwner(ownerId: string) {
    return this.projects.listForOwner(ownerId);
  }

  create(ownerId: string, input: CreateProjectDto) {
    return this.projects.create(ownerId, input);
  }

  update(ownerId: string, projectId: string, input: UpdateProjectDto) {
    return this.projects.update(ownerId, projectId, input);
  }

  updateMode(ownerId: string, projectId: string, input: UpdateProjectDto) {
    return this.update(ownerId, projectId, input);
  }

  activate(ownerId: string, projectId: string) {
    return this.projects.activate(ownerId, projectId);
  }

  archive(ownerId: string, projectId: string, version: number) {
    return this.projects.archive(ownerId, projectId, version);
  }
}
