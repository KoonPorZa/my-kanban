import { Module } from '@nestjs/common';

import { BoardsModule } from '../boards/boards.module';
import { IssuesModule } from '../issues/issues.module';
import { McpTokensModule } from '../mcp-tokens/mcp-tokens.module';
import { McpController } from './mcp.controller';
import { McpServerFactory } from './mcp-server.factory';
import { McpInvocationsService } from './mcp-invocations.service';
import { McpInvocationsRepository } from './mcp-invocations.repository';
import { PrismaMcpInvocationsRepository } from './prisma-mcp-invocations.repository';

@Module({
  imports: [BoardsModule, IssuesModule, McpTokensModule],
  controllers: [McpController],
  providers: [
    McpServerFactory,
    McpInvocationsService,
    { provide: McpInvocationsRepository, useClass: PrismaMcpInvocationsRepository },
  ],
})
export class McpModule {}
