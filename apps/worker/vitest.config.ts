import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineProject } from 'vitest/config';

const here = path.dirname(fileURLToPath(import.meta.url));
const migrations = await readD1Migrations(path.join(here, 'migrations'));

/**
 * Runs tests inside the real workerd runtime with Durable Objects and D1 available, as either
 * site: vitest.config.ts is Acrosticle, vitest.crossword.config.ts is Crosswordicle (which signs
 * in through Acrosticle, so it has no Google secret).
 */
export function workerTestConfig(site: 'acrostic' | 'crossword') {
  const crossword = site === 'crossword';
  const SITE = crossword
    ? {
        APP_ORIGIN: 'https://crosswordicle.test',
        SITE_KIND: 'crossword',
        extra: { GOOGLE_CLIENT_SECRET: '' },
      }
    : { APP_ORIGIN: 'https://acrosticle.test', SITE_KIND: 'acrostic', extra: {} };
  return defineProject({
    plugins: [
      cloudflareTest({
        wrangler: { configPath: './wrangler.jsonc' },
        miniflare: {
          bindings: {
            APP_ORIGIN: SITE.APP_ORIGIN,
            SITE_KIND: SITE.SITE_KIND,
            ACROSTIC_ORIGIN: 'https://acrosticle.test',
            CROSSWORD_ORIGIN: 'https://crosswordicle.test',
            SIGN_IN_ORIGIN: 'https://acrosticle.test',
            COOKIE_DOMAIN: '',
            GOOGLE_CLIENT_ID: 'test-client-id',
            GOOGLE_CLIENT_SECRET: 'test-client-secret',
            CREATOR_ALLOWLIST: ' Ada@Example.com , bo@example.com',
            ANTHROPIC_API_KEY: 'test-anthropic-key',
            TEST_MIGRATIONS: migrations,
            ...SITE.extra,
          },
        },
      }),
    ],
    test: {
      name: crossword ? 'worker-crossword' : 'worker',
      // Each site runs only its own integration tests; unit tests run once, with the acrostic site.
      ...(crossword
        ? { include: ['tests/crossword/**/*.test.ts'] }
        : { exclude: ['tests/crossword/**', '**/node_modules/**'] }),
      setupFiles: ['./tests/support/applyMigrations.ts'],
    },
  });
}

export default workerTestConfig('acrostic');
