import type { D1Migration } from 'cloudflare:test';

declare global {
  namespace Cloudflare {
    interface Env {
      /** Test-only binding: the D1 migrations, read in vitest.config.ts. */
      TEST_MIGRATIONS: D1Migration[];
    }
  }
}
