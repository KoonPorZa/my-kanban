import { Transform, Type } from 'class-transformer';
import {
  Min,
  IsInt,
  IsEnum,
  IsString,
  IsOptional,
  IsNotEmpty,
  MaxLength,
  IsIn,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum ProjectModeDto {
  kanban = 'kanban',
  scrum = 'scrum',
}

export class CreateProjectDto {
  @ApiProperty({ maxLength: 120 })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ maxLength: 32, default: 'primary' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  color?: string;

  @ApiPropertyOptional({ enum: ProjectModeDto, default: ProjectModeDto.kanban })
  @IsOptional()
  @IsEnum(ProjectModeDto)
  mode?: ProjectModeDto;
}

export class UpdateProjectDto {
  @ApiProperty({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version!: number;

  @ApiPropertyOptional({ maxLength: 120 })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ maxLength: 32 })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  color?: string;

  @ApiPropertyOptional({ enum: ProjectModeDto })
  @IsOptional()
  @IsEnum(ProjectModeDto)
  mode?: ProjectModeDto;

  @ApiPropertyOptional({ enum: [7, 14, 30] })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsIn([7, 14, 30])
  doneRetentionDays?: number;
}

export class VersionedProjectCommandDto {
  @ApiProperty({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version!: number;
}
