import { ApiProperty } from '@nestjs/swagger';

export class ChecklistItemResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  isCompleted!: boolean;
}

export class IssueResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  projectId!: string;

  @ApiProperty({ format: 'uuid', nullable: true, type: String })
  sprintId!: string | null;

  @ApiProperty({ format: 'uuid' })
  columnId!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  description!: string;

  @ApiProperty({ enum: ['task', 'story', 'bug', 'chore'] })
  type!: 'task' | 'story' | 'bug' | 'chore';

  @ApiProperty({ enum: ['urgent', 'high', 'medium', 'low', 'none'] })
  priority!: 'urgent' | 'high' | 'medium' | 'low' | 'none';

  @ApiProperty({ type: [String] })
  labels!: string[];

  @ApiProperty({ nullable: true, type: Number, minimum: 0, maximum: 100 })
  storyPoints!: number | null;

  @ApiProperty({ nullable: true, type: String, format: 'date-time' })
  dueDate!: string | null;

  @ApiProperty()
  isBlocked!: boolean;

  @ApiProperty({ nullable: true, type: String })
  blockedReason!: string | null;

  @ApiProperty({ type: [ChecklistItemResponseDto] })
  checklist!: ChecklistItemResponseDto[];

  @ApiProperty({ minimum: 0 })
  checklistIncompleteCount!: number;

  @ApiProperty({ nullable: true, type: String, format: 'date-time' })
  completedAt!: string | null;

  @ApiProperty()
  version!: number;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}
