import { cloudflareTest } from '@cloudflare/vitest-plugin';
import { defineProject } from 'vitest/config';

/** Runs tests inside the real workerd runtime with Durable Objects available. */
export default defineProject({
  plugins: [cloudflareTest({ wrangler: { configPath: './wrangler.jsonc' } })],
  test: {
    name: 'worker',
  },
});
