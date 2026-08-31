import type { Request, Response } from 'express';

import { randomUUID } from 'node:crypto';

import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import {
  All,
  Req,
  Res,
  Inject,
  Controller,
  VERSION_NEUTRAL,
  type OnModuleDestroy,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';

import { Public } from '../auth/decorators/public.decorator';
import { DomainUnauthorizedError } from '../common/domain/domain-errors';
import { McpTokensService } from '../mcp-tokens/mcp-tokens.service';
import type { McpTokenPrincipal } from '../mcp-tokens/mcp-token.types';
import { McpServerFactory } from './mcp-server.factory';

type McpSession = {
  transport: StreamableHTTPServerTransport;
  server: ReturnType<McpServerFactory['create']>;
  principal: McpTokenPrincipal;
  lastSeenAt: number;
};

const MCP_SESSION_IDLE_MS = 60 * 60 * 1000;

@Public()
@ApiExcludeController()
@Throttle({ default: { limit: 60, ttl: 60_000 } })
@Controller({ path: 'mcp', version: VERSION_NEUTRAL })
export class McpController implements OnModuleDestroy {
  private readonly sessions = new Map<string, McpSession>();
  private readonly appOrigin: string;

  constructor(
    @Inject(McpTokensService) private readonly tokens: McpTokensService,
    @Inject(McpServerFactory) private readonly servers: McpServerFactory,
    config: ConfigService
  ) {
    this.appOrigin = config.getOrThrow<string>('APP_ORIGIN');
  }

  @All()
  async handle(@Req() request: Request, @Res() response: Response) {
    try {
      await this.pruneSessions();
      this.assertOrigin(request.headers.origin);
      const principal = await this.tokens.authenticate(this.header(request, 'authorization'));
      const sessionId = this.header(request, 'mcp-session-id');

      if (sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session || session.principal.tokenId !== principal.tokenId) {
          throw new DomainUnauthorizedError('The MCP session is not valid for this token');
        }
        session.lastSeenAt = Date.now();
        await session.transport.handleRequest(request, response, request.body);
        return;
      }

      if (request.method !== 'POST' || !isInitializeRequest(request.body)) {
        this.protocolError(response, 400, -32000, 'A valid MCP session is required');
        return;
      }

      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        enableJsonResponse: true,
        onsessioninitialized: (initializedSessionId) => {
          this.sessions.set(initializedSessionId, session);
        },
        onsessionclosed: (closedSessionId) => {
          this.sessions.delete(closedSessionId);
        },
      });
      const server = this.servers.create(principal);
      const session: McpSession = { transport, server, principal, lastSeenAt: Date.now() };
      transport.onclose = () => {
        if (transport.sessionId) this.sessions.delete(transport.sessionId);
      };

      await server.connect(transport);
      await transport.handleRequest(request, response, request.body);
    } catch (error) {
      if (response.headersSent) return;
      if (error instanceof DomainUnauthorizedError) {
        response.setHeader('WWW-Authenticate', 'Bearer');
        this.protocolError(response, 401, -32001, error.message);
        return;
      }
      this.protocolError(response, 500, -32603, 'Internal MCP server error');
    }
  }

  async onModuleDestroy() {
    const sessions = [...this.sessions.values()];
    this.sessions.clear();
    await Promise.allSettled(sessions.map((session) => session.server.close()));
  }

  private assertOrigin(origin: string | undefined) {
    if (origin && origin !== this.appOrigin) {
      throw new DomainUnauthorizedError('Origin is not allowed');
    }
  }

  private header(request: Request, name: string) {
    const value = request.headers[name];
    return Array.isArray(value) ? value[0] : value;
  }

  private protocolError(response: Response, status: number, code: number, message: string) {
    response.status(status).json({ jsonrpc: '2.0', error: { code, message }, id: null });
  }

  private async pruneSessions() {
    const cutoff = Date.now() - MCP_SESSION_IDLE_MS;
    const stale = [...this.sessions.entries()].filter((entry) => entry[1].lastSeenAt < cutoff);
    for (const [sessionId, session] of stale) {
      this.sessions.delete(sessionId);
      await session.server.close();
    }
  }
}
