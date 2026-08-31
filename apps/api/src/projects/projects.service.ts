import { Injectable } from '@nestjs/common';

import { ProjectsRepository } from './projects.repository';

@Injectable()
export class ProjectsService {
  constructor(private readonly projects: ProjectsRepository) {}

  listForOwner(ownerId: string) {
    return this.projects.listForOwner(ownerId);
  }
}
