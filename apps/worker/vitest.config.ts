import { cloudflareTest } from '@cloudflare/vitest-plugin';
import { defineProject } from 'vitest/config';

/** Runs tests inside the real workerd runtime with Durable Objects available. */
export default defineProject({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './wrangler.jsonc' },
      miniflare: { bindings: { DEV_ALLOW_ANONYMOUS: 'true' } },
    }),
  ],
  test: {
    name: 'worker',
  },
});
