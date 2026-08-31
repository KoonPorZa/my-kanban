import type { BoardResponseDto, BoardColumnResponseDto } from './dto/board-response.dto';
import type { MoveColumnDto, CreateColumnDto, UpdateColumnDto } from './dto/column-mutation.dto';

export abstract class BoardsRepository {
  abstract get(ownerId: string, projectId: string): Promise<BoardResponseDto>;

  abstract createColumn(
    ownerId: string,
    projectId: string,
    input: CreateColumnDto
  ): Promise<BoardColumnResponseDto>;

  abstract updateColumn(
    ownerId: string,
    columnId: string,
    input: UpdateColumnDto
  ): Promise<BoardColumnResponseDto>;

  abstract moveColumn(
    ownerId: string,
    columnId: string,
    input: MoveColumnDto
  ): Promise<BoardColumnResponseDto>;

  abstract clearColumn(
    ownerId: string,
    columnId: string,
    version: number
  ): Promise<BoardColumnResponseDto>;

  abstract archiveColumn(
    ownerId: string,
    columnId: string,
    version: number
  ): Promise<BoardColumnResponseDto>;
}
