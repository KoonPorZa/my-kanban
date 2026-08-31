import { Type } from 'class-transformer';
import { IsEnum, IsInt, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum ProjectModeDto {
  kanban = 'kanban',
  scrum = 'scrum',
}

export class UpdateProjectModeDto {
  @ApiProperty({ enum: ProjectModeDto })
  @IsEnum(ProjectModeDto)
  mode!: ProjectModeDto;

  @ApiProperty({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version!: number;
}
