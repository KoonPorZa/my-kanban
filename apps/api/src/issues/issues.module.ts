import { Module } from '@nestjs/common';

import { IssuesService } from './issues.service';
import { IssuesController } from './issues.controller';
import { IssuesRepository } from './issues.repository';
import { PrismaIssuesRepository } from './prisma-issues.repository';

@Module({
  controllers: [IssuesController],
  providers: [IssuesService, { provide: IssuesRepository, useClass: PrismaIssuesRepository }],
  exports: [IssuesService],
})
export class IssuesModule {}
