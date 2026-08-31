import { ApiProperty } from '@nestjs/swagger';

import { IssueResponseDto } from '../../issues/dto/issue-response.dto';

export class BoardProjectDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ enum: ['kanban', 'scrum'] })
  mode!: 'kanban' | 'scrum';

  @ApiProperty()
  version!: number;
}

export class BoardColumnResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  projectId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ enum: ['todo', 'in_progress', 'done'] })
  category!: 'todo' | 'in_progress' | 'done';

  @ApiProperty({ nullable: true, type: Number, minimum: 1 })
  wipLimit!: number | null;

  @ApiProperty()
  version!: number;
}

export class BoardResponseDto {
  @ApiProperty({ type: BoardProjectDto })
  project!: BoardProjectDto;

  @ApiProperty({ type: [BoardColumnResponseDto] })
  columns!: BoardColumnResponseDto[];

  @ApiProperty({ type: [IssueResponseDto] })
  issues!: IssueResponseDto[];
}
