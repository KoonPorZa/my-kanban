import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import type { SessionPrincipal } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ProjectsService } from './projects.service';
import { ProjectListResponseDto } from './dto/project-response.dto';

@ApiTags('projects')
@Controller('projects')
export class ProjectsController {
  constructor(@Inject(ProjectsService) private readonly projects: ProjectsService) {}

  @Get()
  @ApiOperation({ operationId: 'listProjects', summary: 'List owner projects' })
  @ApiOkResponse({ type: ProjectListResponseDto })
  list(@CurrentUser() user: SessionPrincipal) {
    return this.projects.listForOwner(user.userId);
  }
}
