import { Body, Controller, Get, Inject, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOkResponse, ApiCreatedResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import type { SessionPrincipal } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { BoardsService } from './boards.service';
import { BoardResponseDto, BoardColumnResponseDto } from './dto/board-response.dto';
import { BoardQueryDto } from './dto/board-query.dto';
import {
  MoveColumnDto,
  CreateColumnDto,
  UpdateColumnDto,
  ArchiveColumnDto,
  VersionedColumnCommandDto,
} from './dto/column-mutation.dto';

@ApiTags('boards')
@Controller()
export class BoardsController {
  constructor(@Inject(BoardsService) private readonly boards: BoardsService) {}

  @Get('projects/:projectId/board')
  @ApiOperation({ operationId: 'getBoard', summary: 'Get the active board aggregate' })
  @ApiOkResponse({ type: BoardResponseDto })
  get(
    @CurrentUser() user: SessionPrincipal,
    @Param('projectId') projectId: string,
    @Query() query: BoardQueryDto
  ) {
    return this.boards.get(user.userId, projectId, query.sprintId);
  }

  @Post('projects/:projectId/columns')
  @ApiOperation({ operationId: 'createColumn', summary: 'Create a board column' })
  @ApiCreatedResponse({ type: BoardColumnResponseDto })
  createColumn(
    @CurrentUser() user: SessionPrincipal,
    @Param('projectId') projectId: string,
    @Body() input: CreateColumnDto
  ) {
    return this.boards.createColumn(user.userId, projectId, input);
  }

  @Patch('columns/:columnId')
  @ApiOperation({ operationId: 'updateColumn', summary: 'Update a board column' })
  @ApiOkResponse({ type: BoardColumnResponseDto })
  updateColumn(
    @CurrentUser() user: SessionPrincipal,
    @Param('columnId') columnId: string,
    @Body() input: UpdateColumnDto
  ) {
    return this.boards.updateColumn(user.userId, columnId, input);
  }

  @Post('columns/:columnId/move')
  @ApiOperation({ operationId: 'moveColumn', summary: 'Move and reorder a board column' })
  @ApiOkResponse({ type: BoardColumnResponseDto })
  moveColumn(
    @CurrentUser() user: SessionPrincipal,
    @Param('columnId') columnId: string,
    @Body() input: MoveColumnDto
  ) {
    return this.boards.moveColumn(user.userId, columnId, input);
  }

  @Post('columns/:columnId/clear')
  @ApiOperation({ operationId: 'clearColumn', summary: 'Archive every task in a column' })
  @ApiOkResponse({ type: BoardColumnResponseDto })
  clearColumn(
    @CurrentUser() user: SessionPrincipal,
    @Param('columnId') columnId: string,
    @Body() input: VersionedColumnCommandDto
  ) {
    return this.boards.clearColumn(user.userId, columnId, input.version, input.sprintId);
  }

  @Post('columns/:columnId/archive')
  @ApiOperation({ operationId: 'archiveColumn', summary: 'Archive a board column' })
  @ApiOkResponse({ type: BoardColumnResponseDto })
  archiveColumn(
    @CurrentUser() user: SessionPrincipal,
    @Param('columnId') columnId: string,
    @Body() input: ArchiveColumnDto
  ) {
    return this.boards.archiveColumn(user.userId, columnId, input);
  }
}
