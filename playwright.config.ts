import { defineConfig, devices } from '@playwright/test';

// Separate ports and storage from `npm run dev`, so e2e runs never reuse or
// collide with a dev session that's already open.
const WEB_PORT = 5174;
const WORKER_PORT = 8788;
// Crosswordicle: the same app and Worker, built and run as the crossword site.
const CROSSWORD_WEB_PORT = 5176;
const CROSSWORD_WORKER_PORT = 8790;
const CROSSWORD_SPECS = /crossword.*\.spec\.ts$/;

export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // The local Workers runtime occasionally stalls a Durable Object request for several seconds
  // (seen in local dev only; see docs/architecture.md, Known issues), so retry once locally too.
  retries: process.env.CI ? 2 : 1,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }, testIgnore: CROSSWORD_SPECS },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testIgnore: CROSSWORD_SPECS },
    {
      name: 'crossword',
      use: { ...devices['Desktop Chrome'], baseURL: `http://localhost:${CROSSWORD_WEB_PORT}` },
      testMatch: CROSSWORD_SPECS,
    },
    {
      name: 'crossword-mobile',
      use: { ...devices['Pixel 7'], baseURL: `http://localhost:${CROSSWORD_WEB_PORT}` },
      testMatch: CROSSWORD_SPECS,
    },
  ],
  // Start both servers and wait for each, so tests never hit a half-started backend.
  webServer: [
    {
      // Own database and settings (e2e.env, not your .dev.vars): sign-in is deliberately off.
      command: [
        'npm run db:migrate:local -w @gridicles/worker -- --persist-to .wrangler/e2e-state',
        `npm run serve -w @gridicles/worker -- --port ${WORKER_PORT} --inspector-port 0 --persist-to .wrangler/e2e-state --env-file e2e.env`,
      ].join(' && '),
      url: `http://localhost:${WORKER_PORT}/api/health`,
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: `npm run dev -w @gridicles/web -- --port ${WEB_PORT}`,
      env: { ACROSTICLE_WORKER_PORT: String(WORKER_PORT) },
      url: `http://localhost:${WEB_PORT}`,
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      // Its own state, so the two local Workers don't share (and lock) one database file.
      command: [
        'npm run db:migrate:local -w @gridicles/worker -- --env crossword --persist-to .wrangler/e2e-crossword-state',
        `npm run serve -w @gridicles/worker -- --env crossword --port ${CROSSWORD_WORKER_PORT} --inspector-port 0 --persist-to .wrangler/e2e-crossword-state --env-file e2e-crossword.env`,
      ].join(' && '),
      url: `http://localhost:${CROSSWORD_WORKER_PORT}/api/health`,
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: `npm run dev -w @gridicles/web -- --port ${CROSSWORD_WEB_PORT}`,
      env: { ACROSTICLE_WORKER_PORT: String(CROSSWORD_WORKER_PORT), VITE_SITE: 'crossword' },
      url: `http://localhost:${CROSSWORD_WEB_PORT}`,
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
