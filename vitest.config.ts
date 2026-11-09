import { defineConfig } from 'vitest/config';

/**
 * Root Vitest config. Each workspace is its own Vitest "project" with its own
 * environment (node, jsdom, or the Cloudflare Workers runtime). Coverage is
 * configured here because it is aggregated across all projects.
 */
export default defineConfig({
  test: {
    projects: ['packages/*', 'apps/web', 'apps/worker'],
    coverage: {
      // istanbul (not v8) because the Workers pool does not support v8 coverage.
      provider: 'istanbul',
      include: ['packages/*/src/**/*.{ts,tsx}', 'apps/*/src/**/*.{ts,tsx}'],
      exclude: [
        '**/*.test.{ts,tsx}',
        '**/*.d.ts',
        '**/test/**',
        '**/index.ts',
        'apps/web/src/main.tsx',
      ],
      reporter: ['text', 'html', 'lcov'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
