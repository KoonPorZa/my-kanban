import { Body, Controller, Get, Inject, Param, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import type { SessionPrincipal } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { McpTokensService } from './mcp-tokens.service';
import {
  CreateMcpTokenDto,
  McpTokenResponseDto,
  McpAuditEventResponseDto,
  CreatedMcpTokenResponseDto,
} from './dto/mcp-token.dto';

@ApiTags('mcp-tokens')
@Controller('projects/:projectId')
export class McpTokensController {
  constructor(@Inject(McpTokensService) private readonly tokens: McpTokensService) {}

  @Get('mcp-tokens')
  @ApiOperation({ operationId: 'listMcpTokens', summary: 'List Project MCP tokens' })
  @ApiOkResponse({ type: [McpTokenResponseDto] })
  list(@CurrentUser() user: SessionPrincipal, @Param('projectId') projectId: string) {
    return this.tokens.list(user.userId, projectId);
  }

  @Post('mcp-tokens')
  @ApiOperation({ operationId: 'createMcpToken', summary: 'Create a Project MCP token' })
  @ApiCreatedResponse({ type: CreatedMcpTokenResponseDto })
  create(
    @CurrentUser() user: SessionPrincipal,
    @Param('projectId') projectId: string,
    @Body() input: CreateMcpTokenDto
  ) {
    return this.tokens.create(user.userId, projectId, input);
  }

  @Post('mcp-tokens/:tokenId/revoke')
  @ApiOperation({ operationId: 'revokeMcpToken', summary: 'Revoke a Project MCP token' })
  @ApiOkResponse({ type: McpTokenResponseDto })
  revoke(
    @CurrentUser() user: SessionPrincipal,
    @Param('projectId') projectId: string,
    @Param('tokenId') tokenId: string
  ) {
    return this.tokens.revoke(user.userId, projectId, tokenId);
  }

  @Get('mcp-audit-events')
  @ApiOperation({ operationId: 'listMcpAuditEvents', summary: 'List Project MCP audit events' })
  @ApiOkResponse({ type: [McpAuditEventResponseDto] })
  listAudit(@CurrentUser() user: SessionPrincipal, @Param('projectId') projectId: string) {
    return this.tokens.listAudit(user.userId, projectId);
  }
}
