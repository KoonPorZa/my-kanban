import { Type } from 'class-transformer';
import {
  Min,
  IsInt,
  IsEnum,
  IsString,
  IsOptional,
  IsNotEmpty,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum ColumnCategory {
  todo = 'todo',
  in_progress = 'in_progress',
  done = 'done',
}

export class CreateColumnDto {
  @ApiProperty({ maxLength: 80 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name!: string;

  @ApiPropertyOptional({ enum: ColumnCategory, default: ColumnCategory.todo })
  @IsOptional()
  @IsEnum(ColumnCategory)
  category?: ColumnCategory;

  @ApiPropertyOptional({ minimum: 1, nullable: true, type: Number })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  wipLimit?: number | null;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  beforeColumnId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  afterColumnId?: string;
}

export class UpdateColumnDto {
  @ApiProperty({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version!: number;

  @ApiPropertyOptional({ maxLength: 80 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name?: string;

  @ApiPropertyOptional({ minimum: 1, nullable: true, type: Number })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  wipLimit?: number | null;
}

export class MoveColumnDto {
  @ApiProperty({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version!: number;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  beforeColumnId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  afterColumnId?: string;
}

export class VersionedColumnCommandDto {
  @ApiProperty({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version!: number;

  @ApiPropertyOptional({ format: 'uuid', description: 'Limit the command to one Active Sprint' })
  @IsOptional()
  @IsUUID()
  sprintId?: string;
}
