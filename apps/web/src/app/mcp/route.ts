const FORWARDED_RESPONSE_HEADERS = [
  'cache-control',
  'content-type',
  'mcp-protocol-version',
  'mcp-session-id',
  'retry-after',
  'www-authenticate',
] as const;

async function proxy(request: Request) {
  const apiInternalUrl = process.env.API_INTERNAL_URL ?? 'http://localhost:3001';
  const headers = new Headers(request.headers);
  headers.delete('connection');
  headers.delete('content-length');
  headers.delete('host');

  const upstream = await fetch(`${apiInternalUrl.replace(/\/$/, '')}/mcp`, {
    method: request.method,
    headers,
    body:
      request.method === 'GET' || request.method === 'HEAD'
        ? undefined
        : await request.arrayBuffer(),
    cache: 'no-store',
    redirect: 'manual',
  });

  const responseHeaders = new Headers();
  for (const name of FORWARDED_RESPONSE_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}

export const dynamic = 'force-dynamic';

export const GET = proxy;
export const POST = proxy;
export const DELETE = proxy;
