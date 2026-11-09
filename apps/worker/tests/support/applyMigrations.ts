import { applyD1Migrations } from 'cloudflare:test';
import { env } from 'cloudflare:workers';

// Runs before each test file; per-test storage isolation starts from this state.
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
