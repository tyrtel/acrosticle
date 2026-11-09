import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineProject } from 'vitest/config';

const here = path.dirname(fileURLToPath(import.meta.url));
const migrations = await readD1Migrations(path.join(here, 'migrations'));

/** Runs tests inside the real workerd runtime with Durable Objects and D1 available. */
export default defineProject({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './wrangler.jsonc' },
      miniflare: {
        bindings: {
          APP_ORIGIN: 'https://acrosticle.test',
          GOOGLE_CLIENT_ID: 'test-client-id',
          GOOGLE_CLIENT_SECRET: 'test-client-secret',
          CREATOR_ALLOWLIST: ' Ada@Example.com , bo@example.com',
          TEST_MIGRATIONS: migrations,
        },
      },
    }),
  ],
  test: {
    name: 'worker',
    setupFiles: ['./tests/support/applyMigrations.ts'],
  },
});
