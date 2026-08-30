'use client';

import { QueryClient } from '@tanstack/react-query';

let browserQueryClient: QueryClient | undefined;

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: 1,
        refetchOnWindowFocus: false,
        staleTime: 30_000,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}

export function getQueryClient() {
  if (typeof window === 'undefined') {
    return createQueryClient();
  }

  browserQueryClient ??= createQueryClient();
  return browserQueryClient;
}
