import { ApiProperty } from '@nestjs/swagger';

export class WorkspaceImportEntityCountsDto {
  @ApiProperty({ minimum: 0 })
  projects!: number;

  @ApiProperty({ minimum: 0 })
  columns!: number;

  @ApiProperty({ minimum: 0 })
  sprints!: number;

  @ApiProperty({ minimum: 0 })
  issues!: number;

  @ApiProperty({ minimum: 0 })
  checklistItems!: number;
}

export class WorkspaceImportImpactDto {
  @ApiProperty({ minimum: 0 })
  newProjects!: number;

  @ApiProperty({ minimum: 0 })
  matchingProjects!: number;

  @ApiProperty({ minimum: 0 })
  projectsToArchive!: number;
}

export class WorkspaceImportPreviewDto {
  @ApiProperty({ enum: ['replace', 'merge'] })
  mode!: 'replace' | 'merge';

  @ApiProperty({ enum: [1] })
  schemaVersion!: 1;

  @ApiProperty({ format: 'date-time' })
  exportedAt!: string;

  @ApiProperty()
  workspaceName!: string;

  @ApiProperty({ type: WorkspaceImportEntityCountsDto })
  counts!: WorkspaceImportEntityCountsDto;

  @ApiProperty({ type: WorkspaceImportImpactDto })
  impact!: WorkspaceImportImpactDto;
}
