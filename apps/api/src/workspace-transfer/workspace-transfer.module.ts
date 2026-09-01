import { Module } from '@nestjs/common';

import { WorkspaceTransferService } from './workspace-transfer.service';
import { WorkspaceTransferController } from './workspace-transfer.controller';

@Module({
  controllers: [WorkspaceTransferController],
  providers: [WorkspaceTransferService],
})
export class WorkspaceTransferModule {}
