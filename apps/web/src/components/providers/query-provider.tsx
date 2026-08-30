'use client';

import { QueryClientProvider } from '@tanstack/react-query';

import { getQueryClient } from 'src/lib/query-client';

type QueryProviderProps = {
  children: React.ReactNode;
};

export function QueryProvider({ children }: QueryProviderProps) {
  return <QueryClientProvider client={getQueryClient()}>{children}</QueryClientProvider>;
}
