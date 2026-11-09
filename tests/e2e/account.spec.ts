import { expect, test } from '@playwright/test';

// The e2e worker runs with sign-in unconfigured (apps/worker/e2e.env), so these
// cover the signed-out experience; the sign-in flow itself is tested in the
// worker's integration tests with Google mocked.

test('importing needs sign-in, and says so', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Import a puzzle file' })).toBeDisabled();
  await expect(page.getByText('Sign in to import your own puzzles.')).toBeVisible();
  await expect(page.getByText("Sign-in isn't set up on this server yet.").first()).toBeVisible();
});

test('My puzzles asks visitors to sign in', async ({ page }) => {
  await page.goto('/my');
  await expect(page.getByText("Sign in to see the puzzles you've created.")).toBeVisible();
});

test('a sign-in problem is explained after returning to the app', async ({ page }) => {
  await page.goto('/api/auth/google?returnTo=%2Fmy');
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('alert')).toHaveText(/Sign-in isn't set up on this server yet\./);
});
