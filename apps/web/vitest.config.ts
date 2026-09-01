import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  esbuild: {
    jsx: 'automatic',
  },
  test: {
    exclude: [...configDefaults.exclude, 'e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      // Measure the authored Phase 3 client-state boundary. The upstream Minimal starter UI is
      // intentionally outside this gate; browser behavior and accessibility are covered by
      // Playwright instead of inflating unit coverage with render-only tests.
      include: [
        'src/actions/kanban.ts',
        'src/actions/kanban-board-resilience.ts',
        'src/actions/sprint-backlog.ts',
        'src/actions/workspace-transfer.ts',
        'src/auth/utils/session-expiry.ts',
        'src/hooks/use-delayed-delete.ts',
        'src/sections/kanban/details/task-save-queue.ts',
        'src/sections/kanban/filters/board-filter.ts',
      ],
      // This is a ratcheting baseline for the explicit Phase 3 scope above. The report still
      // exposes lower-covered files instead of hiding them.
      thresholds: {
        statements: 80,
        branches: 75,
        functions: 80,
        lines: 80,
      },
    },
  },
});
