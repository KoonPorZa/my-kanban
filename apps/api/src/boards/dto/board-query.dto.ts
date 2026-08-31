import { IsOptional, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class BoardQueryDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Return only tasks from this Active Sprint',
  })
  @IsOptional()
  @IsUUID()
  sprintId?: string;
}
