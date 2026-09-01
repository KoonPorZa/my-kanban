import { Body, Controller, Get, HttpCode, Inject, Param, Patch, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import type { SessionPrincipal } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ProjectsService } from './projects.service';
import { ProjectListResponseDto, ProjectSummaryDto } from './dto/project-response.dto';
import {
  CreateProjectDto,
  UpdateProjectDto,
  VersionedProjectCommandDto,
} from './dto/project-mutation.dto';

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

  @Post()
  @ApiOperation({ operationId: 'createProject', summary: 'Create and activate a project' })
  @ApiCreatedResponse({ type: ProjectSummaryDto })
  create(@CurrentUser() user: SessionPrincipal, @Body() input: CreateProjectDto) {
    return this.projects.create(user.userId, input);
  }

  @Patch(':projectId')
  @ApiOperation({ operationId: 'updateProject', summary: 'Update a project' })
  @ApiOkResponse({ type: ProjectSummaryDto })
  update(
    @CurrentUser() user: SessionPrincipal,
    @Param('projectId') projectId: string,
    @Body() input: UpdateProjectDto
  ) {
    return this.projects.update(user.userId, projectId, input);
  }

  @Post(':projectId/activate')
  @HttpCode(200)
  @ApiOperation({ operationId: 'activateProject', summary: 'Make a project active' })
  @ApiOkResponse({ type: ProjectSummaryDto })
  activate(@CurrentUser() user: SessionPrincipal, @Param('projectId') projectId: string) {
    return this.projects.activate(user.userId, projectId);
  }

  @Post(':projectId/archive')
  @HttpCode(200)
  @ApiOperation({ operationId: 'archiveProject', summary: 'Archive a project' })
  @ApiOkResponse({ type: ProjectListResponseDto })
  archive(
    @CurrentUser() user: SessionPrincipal,
    @Param('projectId') projectId: string,
    @Body() input: VersionedProjectCommandDto
  ) {
    return this.projects.archive(user.userId, projectId, input.version);
  }
}
