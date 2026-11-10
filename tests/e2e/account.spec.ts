import { expect, test } from '@playwright/test';

// The e2e worker runs with sign-in unconfigured (apps/worker/e2e.env), so these
// cover the signed-out experience; the sign-in flow itself is tested in the
// worker's integration tests with Google mocked.

test('uploading and importing need sign-in, and say so', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Upload a puzzle image' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Import a puzzle file' })).toBeDisabled();
  await expect(page.getByText(/Sign in to add your own puzzles/)).toBeVisible();
  await expect(page.getByText("Sign-in isn't set up on this server yet.").first()).toBeVisible();
});

test('old /my links open the My puzzles panel, which asks visitors to sign in', async ({
  page,
}) => {
  await page.goto('/my');
  const panel = page.getByRole('dialog', { name: 'My puzzles' });
  await expect(panel).toBeVisible();
  await expect(
    panel.getByText("Sign in to see the puzzles you've created and joined."),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/\?panel=my$/);

  // A real <dialog>: Escape closes it.
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
  await expect(page).toHaveURL(/\/$/);
});

test('a sign-in problem is explained after returning to the app', async ({ page }) => {
  await page.goto('/api/auth/google?returnTo=%2Fmy');
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('alert')).toHaveText(/Sign-in isn't set up on this server yet\./);
});
