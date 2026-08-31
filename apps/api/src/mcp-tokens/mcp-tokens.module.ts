import { Module } from '@nestjs/common';

import { McpTokensService } from './mcp-tokens.service';
import { McpTokensController } from './mcp-tokens.controller';
import { McpTokensRepository } from './mcp-tokens.repository';
import { PrismaMcpTokensRepository } from './prisma-mcp-tokens.repository';

@Module({
  controllers: [McpTokensController],
  providers: [
    McpTokensService,
    { provide: McpTokensRepository, useClass: PrismaMcpTokensRepository },
  ],
  exports: [McpTokensService],
})
export class McpTokensModule {}
