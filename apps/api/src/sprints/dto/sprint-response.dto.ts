import { ApiProperty } from '@nestjs/swagger';

export class SprintResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  projectId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  goal!: string;

  @ApiProperty({ enum: ['planned', 'active', 'completed'] })
  status!: 'planned' | 'active' | 'completed';

  @ApiProperty({ type: String, format: 'date' })
  startDate!: string;

  @ApiProperty({ type: String, format: 'date' })
  endDate!: string;

  @ApiProperty({ minimum: 0 })
  plannedPoints!: number;

  @ApiProperty({ minimum: 0 })
  plannedIssueCount!: number;

  @ApiProperty({ minimum: 0 })
  completedPoints!: number;

  @ApiProperty({ minimum: 0 })
  completedIssueCount!: number;

  @ApiProperty({ minimum: 0 })
  incompletePoints!: number;

  @ApiProperty({ minimum: 0 })
  incompleteIssueCount!: number;

  @ApiProperty({ minimum: 0, description: 'Current number of tasks assigned to the sprint' })
  issueCount!: number;

  @ApiProperty({ nullable: true, type: String, format: 'date-time' })
  completedAt!: string | null;

  @ApiProperty({ minimum: 1 })
  version!: number;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}

export class SprintListResponseDto {
  @ApiProperty({ type: [SprintResponseDto] })
  sprints!: SprintResponseDto[];
}
