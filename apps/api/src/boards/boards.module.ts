import { Module } from '@nestjs/common';

import { BoardsService } from './boards.service';
import { BoardsController } from './boards.controller';
import { BoardsRepository } from './boards.repository';
import { PrismaBoardsRepository } from './prisma-boards.repository';

@Module({
  controllers: [BoardsController],
  providers: [BoardsService, { provide: BoardsRepository, useClass: PrismaBoardsRepository }],
  exports: [BoardsService],
})
export class BoardsModule {}
