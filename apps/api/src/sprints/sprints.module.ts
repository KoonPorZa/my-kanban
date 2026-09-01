import { Module } from '@nestjs/common';

import { PrismaSprintsRepository } from './prisma-sprints.repository';
import { SprintsController } from './sprints.controller';
import { SprintsRepository } from './sprints.repository';
import { SprintsService } from './sprints.service';

@Module({
  controllers: [SprintsController],
  providers: [SprintsService, { provide: SprintsRepository, useClass: PrismaSprintsRepository }],
  exports: [SprintsService],
})
export class SprintsModule {}
