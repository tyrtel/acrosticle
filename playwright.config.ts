import { defineConfig, devices } from '@playwright/test';

// Separate ports and storage from `npm run dev`, so e2e runs never reuse or
// collide with a dev session that's already open.
const WEB_PORT = 5174;
const WORKER_PORT = 8788;

export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  // Start both servers and wait for each, so tests never hit a half-started backend.
  webServer: [
    {
      // Own database and settings (e2e.env, not your .dev.vars): sign-in is deliberately off.
      command: [
        'npm run db:migrate:local -w @acrosticle/worker -- --persist-to .wrangler/e2e-state',
        `npm run serve -w @acrosticle/worker -- --port ${WORKER_PORT} --inspector-port 0 --persist-to .wrangler/e2e-state --env-file e2e.env`,
      ].join(' && '),
      url: `http://localhost:${WORKER_PORT}/api/health`,
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: `npm run dev -w @acrosticle/web -- --port ${WEB_PORT}`,
      env: { ACROSTICLE_WORKER_PORT: String(WORKER_PORT) },
      url: `http://localhost:${WEB_PORT}`,
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
