import { it, vi, expect, describe, afterEach } from 'vitest';

import { POST } from './route';

describe('MCP Web proxy', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.API_INTERNAL_URL;
  });

  it('forwards bearer and MCP headers without exposing the private API URL', async () => {
    process.env.API_INTERNAL_URL = 'http://api.railway.internal:3001/';
    const upstreamFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result: {} }), {
        status: 200,
        headers: {
          'content-type': 'application/json',
          'mcp-session-id': 'session-123',
        },
      })
    );
    vi.stubGlobal('fetch', upstreamFetch);

    const response = await POST(
      new Request('http://localhost:8083/mcp', {
        method: 'POST',
        headers: {
          authorization: 'Bearer test-token',
          'content-type': 'application/json',
          'mcp-protocol-version': '2025-06-18',
        },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize' }),
      })
    );

    expect(upstreamFetch).toHaveBeenCalledOnce();
    const [url, init] = upstreamFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://api.railway.internal:3001/mcp');
    expect(new Headers(init.headers).get('authorization')).toBe('Bearer test-token');
    expect(new Headers(init.headers).get('mcp-protocol-version')).toBe('2025-06-18');
    expect(response.headers.get('mcp-session-id')).toBe('session-123');
    expect(await response.json()).toMatchObject({ jsonrpc: '2.0', id: 1 });
  });
});
