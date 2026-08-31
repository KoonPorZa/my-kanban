import { Body, Controller, Get, Inject, Param, Patch } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import type { SessionPrincipal } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ProjectsService } from './projects.service';
import { ProjectListResponseDto, ProjectSummaryDto } from './dto/project-response.dto';
import { UpdateProjectModeDto } from './dto/project-mutation.dto';

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

  @Patch(':projectId')
  @ApiOperation({ operationId: 'updateProject', summary: 'Change the project workflow mode' })
  @ApiOkResponse({ type: ProjectSummaryDto })
  updateMode(
    @CurrentUser() user: SessionPrincipal,
    @Param('projectId') projectId: string,
    @Body() input: UpdateProjectModeDto
  ) {
    return this.projects.updateMode(user.userId, projectId, input);
  }
}
