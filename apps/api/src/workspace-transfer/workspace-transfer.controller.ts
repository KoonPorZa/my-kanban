import type { Response } from 'express';

import {
  Get,
  Res,
  Body,
  Post,
  Param,
  Delete,
  HttpCode,
  Controller,
  UploadedFile,
  UseInterceptors,
  PayloadTooLargeException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiTags,
} from '@nestjs/swagger';
import { Min, IsInt, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';

import type { SessionPrincipal } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { DomainValidationError } from '../common/domain/domain-errors';
import { WorkspaceImportPreviewDto } from './dto/workspace-import-preview.dto';
import {
  WorkspaceImportResultDto,
  WorkspaceExportResponseDto,
  PermanentlyDeletedIssueDto,
  DeletionCandidatesResponseDto,
  PermanentlyDeletedSprintDto,
  PermanentlyDeletedProjectDto,
} from './dto/workspace-transfer-response.dto';
import { WorkspaceTransferService, type WorkspaceImportMode } from './workspace-transfer.service';

const MAX_IMPORT_BYTES = 10 * 1024 * 1024;

class ImportWorkspaceDto {
  @ApiProperty({ enum: ['replace', 'merge'] })
  @IsEnum(['replace', 'merge'])
  mode!: WorkspaceImportMode;
}

class PermanentDeleteDto {
  @ApiProperty({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version!: number;
}

@ApiTags('workspace-data')
@Controller('workspace-data')
export class WorkspaceTransferController {
  constructor(private readonly transfer: WorkspaceTransferService) {}

  @Get('export')
  @ApiOperation({ operationId: 'exportWorkspace', summary: 'Export owner workspace data' })
  @ApiOkResponse({
    type: WorkspaceExportResponseDto,
    description: 'Portable workspace JSON, schema version 1',
  })
  async export(
    @CurrentUser() user: SessionPrincipal,
    @Res({ passthrough: true }) response: Response
  ) {
    const data = await this.transfer.export(user.userId);
    response.setHeader('Content-Disposition', 'attachment; filename="my-kanban-workspace-v1.json"');
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    return data;
  }

  @Post('import')
  @HttpCode(200)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_IMPORT_BYTES, files: 1 } }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['mode', 'file'],
      properties: {
        mode: { type: 'string', enum: ['replace', 'merge'] },
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiOperation({ operationId: 'importWorkspace', summary: 'Import owner workspace data' })
  @ApiOkResponse({ type: WorkspaceImportResultDto })
  async import(
    @CurrentUser() user: SessionPrincipal,
    @Body() input: ImportWorkspaceDto,
    @UploadedFile() file?: { buffer: Buffer; size: number }
  ) {
    const data = this.parseImportFile(file);
    return this.transfer.import(user.userId, data, input.mode);
  }

  @Post('import/preview')
  @HttpCode(200)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_IMPORT_BYTES, files: 1 } }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['mode', 'file'],
      properties: {
        mode: { type: 'string', enum: ['replace', 'merge'] },
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiOperation({
    operationId: 'previewWorkspaceImport',
    summary: 'Validate and preview an owner workspace import without writing data',
  })
  @ApiOkResponse({ type: WorkspaceImportPreviewDto })
  previewImport(
    @CurrentUser() user: SessionPrincipal,
    @Body() input: ImportWorkspaceDto,
    @UploadedFile() file?: { buffer: Buffer; size: number }
  ) {
    const data = this.parseImportFile(file);
    return this.transfer.previewImport(user.userId, data, input.mode);
  }

  @Get('deletion-candidates')
  @ApiOperation({
    operationId: 'listDeletionCandidates',
    summary: 'List owner-scoped permanent deletion candidates and impact counts',
  })
  @ApiOkResponse({ type: DeletionCandidatesResponseDto })
  listDeletionCandidates(@CurrentUser() user: SessionPrincipal) {
    return this.transfer.listDeletionCandidates(user.userId);
  }

  @Delete('projects/:projectId')
  @ApiOperation({
    operationId: 'permanentlyDeleteProject',
    summary: 'Permanently delete an archived Project',
  })
  @ApiOkResponse({ type: PermanentlyDeletedProjectDto })
  permanentlyDeleteProject(
    @CurrentUser() user: SessionPrincipal,
    @Param('projectId') projectId: string,
    @Body() input: PermanentDeleteDto
  ) {
    return this.transfer.permanentlyDeleteProject(user.userId, projectId, input.version);
  }

  @Delete('sprints/:sprintId')
  @ApiOperation({
    operationId: 'permanentlyDeleteSprint',
    summary: 'Permanently delete a non-active Sprint',
  })
  @ApiOkResponse({ type: PermanentlyDeletedSprintDto })
  permanentlyDeleteSprint(
    @CurrentUser() user: SessionPrincipal,
    @Param('sprintId') sprintId: string,
    @Body() input: PermanentDeleteDto
  ) {
    return this.transfer.permanentlyDeleteSprint(user.userId, sprintId, input.version);
  }

  @Delete('issues/:issueId')
  @ApiOperation({
    operationId: 'permanentlyDeleteIssue',
    summary: 'Permanently delete an archived Task',
  })
  @ApiOkResponse({ type: PermanentlyDeletedIssueDto })
  permanentlyDeleteIssue(
    @CurrentUser() user: SessionPrincipal,
    @Param('issueId') issueId: string,
    @Body() input: PermanentDeleteDto
  ) {
    return this.transfer.permanentlyDeleteIssue(user.userId, issueId, input.version);
  }

  private parseImportFile(file?: { buffer: Buffer; size: number }) {
    if (!file) throw new DomainValidationError('A workspace export JSON file is required');
    if (file.size > MAX_IMPORT_BYTES) throw new PayloadTooLargeException('Import exceeds 10 MB');

    let json: unknown;
    try {
      json = JSON.parse(file.buffer.toString('utf8')) as unknown;
    } catch {
      throw new DomainValidationError('Import file must contain valid JSON');
    }
    return this.transfer.parse(json);
  }
}
