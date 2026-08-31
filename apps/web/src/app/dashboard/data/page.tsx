import type { Metadata } from 'next';

import { CONFIG } from 'src/global-config';

import { WorkspaceDataView } from 'src/sections/workspace-data';

export const metadata: Metadata = { title: `Workspace data | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return <WorkspaceDataView />;
}
