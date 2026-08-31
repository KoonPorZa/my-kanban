import type { Metadata } from 'next';

import { CONFIG } from 'src/global-config';

import { McpAccessView } from 'src/sections/mcp-access/mcp-access-view';

export const metadata: Metadata = { title: `AI access | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return <McpAccessView />;
}
