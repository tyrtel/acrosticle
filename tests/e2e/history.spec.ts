import { expect, test } from '@playwright/test';
import { blank, square, startSampleRoom } from './support';

test('Ctrl+Z / Cmd+Z undoes and Ctrl+Y redoes, without the browser interfering', async ({
  page,
}) => {
  await startSampleRoom(page);
  await blank(page, 138).click();
  await page.keyboard.type('DES');
  await expect(square(page, 44)).toHaveAccessibleName(/, S$/);

  await page.keyboard.press('ControlOrMeta+z');
  await expect(square(page, 44)).toHaveAccessibleName(/, empty$/);
  await expect(square(page, 5)).toHaveAccessibleName(/, E$/);

  await page.keyboard.press('ControlOrMeta+z');
  await expect(square(page, 5)).toHaveAccessibleName(/, empty$/);

  await page.keyboard.press('ControlOrMeta+Shift+z');
  await expect(square(page, 5)).toHaveAccessibleName(/, E$/);
});

test('the Undo button undoes, and typing continues afterwards', async ({ page }) => {
  await startSampleRoom(page);
  await blank(page, 138).click();
  await page.keyboard.type('DX');
  await page.getByRole('button', { name: /Undo/ }).click();
  await expect(square(page, 5)).toHaveAccessibleName(/, empty$/);
  await page.keyboard.type('E');
  await expect(square(page, 5)).toHaveAccessibleName(/, E$/);
});
