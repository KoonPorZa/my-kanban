import { defineConfig } from 'orval';

export default defineConfig({
  kanban: {
    input: {
      target: './openapi.json',
    },
    output: {
      mode: 'tags-split',
      target: './src/generated/kanban.ts',
      schemas: './src/generated/model',
      client: 'react-query',
      httpClient: 'axios',
      clean: true,
      prettier: true,
      override: {
        mutator: {
          path: './src/http-client.ts',
          name: 'apiClient',
        },
        query: {
          signal: true,
        },
      },
    },
  },
});
