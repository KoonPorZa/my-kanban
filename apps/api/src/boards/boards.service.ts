import { Injectable } from '@nestjs/common';

import { DomainValidationError } from '../common/domain/domain-errors';
import { BoardsRepository } from './boards.repository';
import type { MoveColumnDto, CreateColumnDto, UpdateColumnDto } from './dto/column-mutation.dto';

@Injectable()
export class BoardsService {
  constructor(private readonly boards: BoardsRepository) {}

  get(ownerId: string, projectId: string, sprintId?: string) {
    return this.boards.get(ownerId, projectId, sprintId);
  }

  getForProject(projectId: string) {
    return this.boards.getForProject(projectId);
  }

  createColumn(ownerId: string, projectId: string, input: CreateColumnDto) {
    return this.boards.createColumn(ownerId, projectId, {
      ...input,
      name: input.name.trim(),
    });
  }

  updateColumn(ownerId: string, columnId: string, input: UpdateColumnDto) {
    if (input.name === undefined && input.wipLimit === undefined) {
      throw new DomainValidationError('At least one field must change');
    }
    return this.boards.updateColumn(ownerId, columnId, {
      ...input,
      name: input.name?.trim(),
    });
  }

  moveColumn(ownerId: string, columnId: string, input: MoveColumnDto) {
    return this.boards.moveColumn(ownerId, columnId, input);
  }

  clearColumn(ownerId: string, columnId: string, version: number, sprintId?: string) {
    return this.boards.clearColumn(ownerId, columnId, version, sprintId);
  }

  archiveColumn(ownerId: string, columnId: string, version: number) {
    return this.boards.archiveColumn(ownerId, columnId, version);
  }
}
