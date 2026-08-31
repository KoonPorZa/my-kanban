import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

import type { ProjectContext } from './types.js';

export async function inspectProject(url: string, token: string): Promise<ProjectContext> {
  const client = new Client({ name: 'my-kanban-helper', version: '0.1.0' });
  const transport = new StreamableHTTPClientTransport(new URL(url), {
    requestInit: { headers: { Authorization: `Bearer ${token}` } },
  });
  try {
    await client.connect(transport);
    const result = await client.callTool({ name: 'get_context', arguments: {} });
    const context = result.structuredContent as
      | {
          project?: { id?: unknown; name?: unknown };
          token?: { expiresAt?: unknown; lastUsedAt?: unknown };
        }
      | undefined;
    if (
      typeof context?.project?.id !== 'string' ||
      typeof context.project.name !== 'string' ||
      typeof context.token?.expiresAt !== 'string'
    ) {
      throw new Error('The MCP server returned an invalid Project context');
    }
    return {
      projectId: context.project.id,
      projectName: context.project.name,
      expiresAt: context.token.expiresAt,
      lastUsedAt: typeof context.token.lastUsedAt === 'string' ? context.token.lastUsedAt : null,
    };
  } finally {
    await client.close();
  }
}
