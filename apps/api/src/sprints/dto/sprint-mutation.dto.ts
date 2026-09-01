import { Type } from 'class-transformer';
import {
  IsArray,
  ArrayUnique,
  ArrayMaxSize,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  Matches,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSprintDto {
  @ApiProperty({ maxLength: 120 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ type: String, maxLength: 500, default: '' })
  @IsString()
  @MaxLength(500)
  goal = '';

  @ApiProperty({ type: String, format: 'date', example: '2026-09-01' })
  @IsISO8601({ strict: true }, { message: 'startDate must be an ISO date' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'startDate must use YYYY-MM-DD' })
  startDate!: string;

  @ApiProperty({ type: String, format: 'date', example: '2026-09-14' })
  @IsISO8601({ strict: true }, { message: 'endDate must be an ISO date' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'endDate must use YYYY-MM-DD' })
  endDate!: string;
}

export class SprintIssueDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  issueId!: string;
}

export class BulkSprintIssuesDto {
  @ApiProperty({ type: [String], format: 'uuid', maxItems: 100 })
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(100)
  @IsUUID(undefined, { each: true })
  issueIds!: string[];
}

export class VersionedSprintCommandDto {
  @ApiProperty({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version!: number;
}

export enum IncompleteDestinationKind {
  backlog = 'backlog',
}

export class CompleteSprintDto extends VersionedSprintCommandDto {
  @ApiProperty({
    description: 'Use backlog or the UUID of another planned sprint in the same project',
    oneOf: [{ enum: [IncompleteDestinationKind.backlog] }, { type: 'string', format: 'uuid' }],
  })
  @IsString()
  @IsNotEmpty()
  incompleteDestination!: string;
}
