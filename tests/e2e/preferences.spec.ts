import { expect, test } from '@playwright/test';
import { blank, square, startSampleRoom } from './support';

test('the theme button switches colors and is remembered', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  const background = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const light = await background();

  const button = page.getByRole('button', { name: /^Theme: / });
  await button.click(); // System → Light: no visible change on a light device
  await button.click(); // → Dark
  await expect(button).toHaveAccessibleName('Theme: Dark. Switch to System.');
  const dark = await background();
  expect(dark).not.toBe(light);

  // Remembered across reloads, and applied before the app starts (no flash of light).
  await page.reload();
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('dark');
  expect(await background()).toBe(dark);
});

test('cells keep exactly what is typed, including lowercase and symbols', async ({ page }) => {
  await startSampleRoom(page);
  await blank(page, 138).click();
  await page.keyboard.type('d');
  // é as phone keyboards, dead keys and IMEs send it: inserted text with no key press.
  await page.keyboard.insertText('é');
  await page.keyboard.type('7?');
  await expect(square(page, 138)).toHaveAccessibleName(/, d$/);
  await expect(square(page, 5)).toHaveAccessibleName(/, é$/);
  await expect(square(page, 44)).toHaveAccessibleName(/, 7$/);
  await expect(square(page, 232)).toHaveAccessibleName(/, \?$/);
});

test('"New puzzle" goes back to the start screen from a room', async ({ page }) => {
  await startSampleRoom(page);
  await page.getByRole('button', { name: 'New puzzle' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('button', { name: 'Try the sample puzzle' })).toBeVisible();
});
