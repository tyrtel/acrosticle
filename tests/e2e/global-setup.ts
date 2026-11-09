import { chromium, type FullConfig } from '@playwright/test';

/**
 * Warms up freshly started dev servers by walking the "create a room" path
 * once, before tests run in parallel. On a cold start, the first concurrent
 * room creations can stall in the local dev stack for tens of seconds.
 */
export default async function globalSetup(config: FullConfig): Promise<void> {
  const baseURL = config.projects[0]?.use.baseURL;
  if (!baseURL) throw new Error('baseURL is not configured');

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ baseURL });
    await page.goto('/');
    await page.getByRole('button', { name: 'Try the sample puzzle' }).click();
    await page.waitForURL(/\/r\/[A-Za-z0-9_-]{22}$/, { timeout: 90_000 });
    await page.getByLabel(/Your name/).fill('Warm-up');
    await page.getByRole('button', { name: 'Join' }).click();
    await page.getByRole('status').filter({ hasText: 'Live' }).waitFor({ timeout: 30_000 });
  } finally {
    await browser.close();
  }
}
