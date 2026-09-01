import { ApiProperty } from '@nestjs/swagger';

export class ProjectSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  color!: string;

  @ApiProperty({ enum: ['kanban', 'scrum'] })
  mode!: 'kanban' | 'scrum';

  @ApiProperty()
  version!: number;

  @ApiProperty({ enum: [7, 14, 30] })
  doneRetentionDays!: number;
}

export class ProjectListResponseDto {
  @ApiProperty({ format: 'uuid', nullable: true, type: String })
  activeProjectId!: string | null;

  @ApiProperty({ type: [ProjectSummaryDto] })
  projects!: ProjectSummaryDto[];
}
