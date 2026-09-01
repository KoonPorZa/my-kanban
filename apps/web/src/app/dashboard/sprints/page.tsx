import type { Metadata } from 'next';

import { CONFIG } from 'src/global-config';

import { SprintsView } from 'src/sections/sprints/sprints-view';

export const metadata: Metadata = { title: `Sprints | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return <SprintsView />;
}
