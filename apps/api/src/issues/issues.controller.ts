import { Body, Controller, Inject, Param, Patch, Post } from '@nestjs/common';
import { ApiOkResponse, ApiCreatedResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import type { SessionPrincipal } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { IssuesService } from './issues.service';
import { IssueResponseDto } from './dto/issue-response.dto';
import {
  MoveIssueDto,
  CreateIssueDto,
  UpdateIssueDto,
  VersionedIssueCommandDto,
} from './dto/issue-mutation.dto';

@ApiTags('issues')
@Controller()
export class IssuesController {
  constructor(@Inject(IssuesService) private readonly issues: IssuesService) {}

  @Post('projects/:projectId/issues')
  @ApiOperation({ operationId: 'createIssue', summary: 'Create a task in a project' })
  @ApiCreatedResponse({ type: IssueResponseDto })
  create(
    @CurrentUser() user: SessionPrincipal,
    @Param('projectId') projectId: string,
    @Body() input: CreateIssueDto
  ) {
    return this.issues.create(user.userId, projectId, input);
  }

  @Patch('issues/:issueId')
  @ApiOperation({ operationId: 'updateIssue', summary: 'Update a task' })
  @ApiOkResponse({ type: IssueResponseDto })
  update(
    @CurrentUser() user: SessionPrincipal,
    @Param('issueId') issueId: string,
    @Body() input: UpdateIssueDto
  ) {
    return this.issues.update(user.userId, issueId, input);
  }

  @Post('issues/:issueId/move')
  @ApiOperation({ operationId: 'moveIssue', summary: 'Move and reorder a task' })
  @ApiOkResponse({ type: IssueResponseDto })
  move(
    @CurrentUser() user: SessionPrincipal,
    @Param('issueId') issueId: string,
    @Body() input: MoveIssueDto
  ) {
    return this.issues.move(user.userId, issueId, input);
  }

  @Post('issues/:issueId/archive')
  @ApiOperation({ operationId: 'archiveIssue', summary: 'Archive a task' })
  @ApiOkResponse({ type: IssueResponseDto })
  archive(
    @CurrentUser() user: SessionPrincipal,
    @Param('issueId') issueId: string,
    @Body() input: VersionedIssueCommandDto
  ) {
    return this.issues.archive(user.userId, issueId, input.version);
  }
}
