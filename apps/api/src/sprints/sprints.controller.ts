import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';

import type { SessionPrincipal } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateIssueDto } from '../issues/dto/issue-mutation.dto';
import { IssueResponseDto } from '../issues/dto/issue-response.dto';
import {
  CompleteSprintDto,
  BulkSprintIssuesDto,
  CreateSprintDto,
  SprintIssueDto,
  VersionedSprintCommandDto,
} from './dto/sprint-mutation.dto';
import { SprintListResponseDto, SprintResponseDto } from './dto/sprint-response.dto';
import { SprintsService } from './sprints.service';

@ApiTags('sprints')
@Controller()
export class SprintsController {
  constructor(@Inject(SprintsService) private readonly sprints: SprintsService) {}

  @Get('projects/:projectId/sprints')
  @ApiOperation({ operationId: 'listSprints', summary: 'List project Sprints' })
  @ApiParam({ name: 'projectId', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ type: SprintListResponseDto })
  list(
    @CurrentUser() user: SessionPrincipal,
    @Param('projectId', ParseUUIDPipe) projectId: string
  ) {
    return this.sprints.list(user.userId, projectId);
  }

  @Post('projects/:projectId/sprints')
  @ApiOperation({ operationId: 'createSprint', summary: 'Create a planned Sprint' })
  @ApiParam({ name: 'projectId', schema: { type: 'string', format: 'uuid' } })
  @ApiCreatedResponse({ type: SprintResponseDto })
  create(
    @CurrentUser() user: SessionPrincipal,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() input: CreateSprintDto
  ) {
    return this.sprints.create(user.userId, projectId, input);
  }

  @Post('sprints/:sprintId/issues')
  @ApiOperation({ operationId: 'addIssueToSprint', summary: 'Assign a task to a Sprint' })
  @ApiParam({ name: 'sprintId', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ type: SprintResponseDto })
  addIssue(
    @CurrentUser() user: SessionPrincipal,
    @Param('sprintId', ParseUUIDPipe) sprintId: string,
    @Body() input: SprintIssueDto
  ) {
    return this.sprints.addIssue(user.userId, sprintId, input.issueId);
  }

  @Post('sprints/:sprintId/issues/bulk')
  @ApiOperation({
    operationId: 'bulkAddIssuesToSprint',
    summary: 'Assign multiple tasks to a Sprint atomically',
  })
  @ApiParam({ name: 'sprintId', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ type: SprintResponseDto })
  @HttpCode(HttpStatus.OK)
  bulkAddIssues(
    @CurrentUser() user: SessionPrincipal,
    @Param('sprintId', ParseUUIDPipe) sprintId: string,
    @Body() input: BulkSprintIssuesDto
  ) {
    return this.sprints.bulkAddIssues(user.userId, sprintId, input.issueIds);
  }

  @Post('sprints/:sprintId/issues/create')
  @ApiOperation({
    operationId: 'createIssueInSprint',
    summary: 'Create a task directly in a Sprint',
  })
  @ApiParam({ name: 'sprintId', schema: { type: 'string', format: 'uuid' } })
  @ApiCreatedResponse({ type: IssueResponseDto })
  createIssue(
    @CurrentUser() user: SessionPrincipal,
    @Param('sprintId', ParseUUIDPipe) sprintId: string,
    @Body() input: CreateIssueDto
  ) {
    return this.sprints.createIssue(user.userId, sprintId, input);
  }

  @Delete('sprints/:sprintId/issues/:issueId')
  @ApiOperation({ operationId: 'removeIssueFromSprint', summary: 'Remove a task from a Sprint' })
  @ApiParam({ name: 'sprintId', schema: { type: 'string', format: 'uuid' } })
  @ApiParam({ name: 'issueId', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ type: SprintResponseDto })
  removeIssue(
    @CurrentUser() user: SessionPrincipal,
    @Param('sprintId', ParseUUIDPipe) sprintId: string,
    @Param('issueId', ParseUUIDPipe) issueId: string
  ) {
    return this.sprints.removeIssue(user.userId, sprintId, issueId);
  }

  @Post('sprints/:sprintId/start')
  @ApiOperation({ operationId: 'startSprint', summary: 'Start a planned Sprint' })
  @ApiParam({ name: 'sprintId', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ type: SprintResponseDto })
  start(
    @CurrentUser() user: SessionPrincipal,
    @Param('sprintId', ParseUUIDPipe) sprintId: string,
    @Body() input: VersionedSprintCommandDto
  ) {
    return this.sprints.start(user.userId, sprintId, input.version);
  }

  @Post('sprints/:sprintId/complete')
  @ApiOperation({ operationId: 'completeSprint', summary: 'Complete an active Sprint' })
  @ApiParam({ name: 'sprintId', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ type: SprintResponseDto })
  complete(
    @CurrentUser() user: SessionPrincipal,
    @Param('sprintId', ParseUUIDPipe) sprintId: string,
    @Body() input: CompleteSprintDto
  ) {
    return this.sprints.complete(user.userId, sprintId, input);
  }
}
