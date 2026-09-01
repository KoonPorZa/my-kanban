import { Type } from 'class-transformer';
import {
  Max,
  Min,
  IsInt,
  IsEnum,
  IsArray,
  IsString,
  IsBoolean,
  IsISO8601,
  IsOptional,
  IsNotEmpty,
  IsUUID,
  MaxLength,
  ArrayMaxSize,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';

export enum TaskPriority {
  urgent = 'urgent',
  high = 'high',
  medium = 'medium',
  low = 'low',
  none = 'none',
}

export enum TaskType {
  task = 'task',
  story = 'story',
  bug = 'bug',
  chore = 'chore',
}

export class ChecklistItemInputDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiProperty({ maxLength: 300 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  title!: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isCompleted?: boolean;
}

export class CreateIssueDto {
  @ApiProperty({ maxLength: 200 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  columnId!: string;

  @ApiPropertyOptional({ maxLength: 50_000, default: '' })
  @IsOptional()
  @IsString()
  @MaxLength(50_000)
  description?: string;

  @ApiPropertyOptional({ enum: TaskType, default: TaskType.task })
  @IsOptional()
  @IsEnum(TaskType)
  type?: TaskType;

  @ApiPropertyOptional({ enum: TaskPriority, default: TaskPriority.medium })
  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @ApiPropertyOptional({ type: [String], maxItems: 20 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  labels?: string[];

  @ApiPropertyOptional({ minimum: 0, maximum: 100, nullable: true, type: Number })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  storyPoints?: number | null;

  @ApiPropertyOptional({ format: 'date-time', nullable: true, type: String })
  @IsOptional()
  @IsISO8601()
  dueDate?: string | null;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isBlocked?: boolean;

  @ApiPropertyOptional({ maxLength: 500, nullable: true, type: String })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  blockedReason?: string | null;

  @ApiPropertyOptional({ type: [ChecklistItemInputDto], maxItems: 100 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ChecklistItemInputDto)
  checklist?: ChecklistItemInputDto[];

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  beforeIssueId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  afterIssueId?: string;
}

class UpdateIssueFieldsDto extends OmitType(CreateIssueDto, [
  'columnId',
  'beforeIssueId',
  'afterIssueId',
] as const) {}

export class UpdateIssueDto extends PartialType(UpdateIssueFieldsDto) {
  @ApiProperty({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version!: number;
}

export class MoveIssueDto {
  @ApiProperty({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version!: number;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  targetColumnId!: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Visible Sprint scope used when ordering tasks on the Scrum Board',
  })
  @IsOptional()
  @IsUUID()
  sprintId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  beforeIssueId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  afterIssueId?: string;

  @ApiPropertyOptional({
    default: false,
    description: 'Explicitly allow moving a task with unfinished checklist items to Done',
  })
  @IsOptional()
  @IsBoolean()
  allowIncompleteChecklist?: boolean;
}

export class VersionedIssueCommandDto {
  @ApiProperty({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version!: number;
}

export class DuplicateIssueDto extends VersionedIssueCommandDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  targetColumnId?: string;
}

export class RestoreIssueDto extends VersionedIssueCommandDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  targetColumnId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  beforeIssueId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  afterIssueId?: string;
}
