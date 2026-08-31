import { Module } from '@nestjs/common';

import { ProjectsService } from './projects.service';
import { ProjectsController } from './projects.controller';
import { ProjectsRepository } from './projects.repository';
import { PrismaProjectsRepository } from './prisma-projects.repository';

@Module({
  controllers: [ProjectsController],
  providers: [ProjectsService, { provide: ProjectsRepository, useClass: PrismaProjectsRepository }],
  exports: [ProjectsService],
})
export class ProjectsModule {}
