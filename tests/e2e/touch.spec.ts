import { devices, expect, test } from '@playwright/test';
import { blank, square, startSampleRoom } from './support';

// A phone: touch input, and text that arrives without key presses (as from an
// on-screen keyboard).
test.use({ ...devices['Pixel 7'] });

test('tapping a square readies typing, and on-screen keyboard text fills squares', async ({
  page,
}) => {
  await startSampleRoom(page);
  await blank(page, 138).tap();
  await expect(page.getByRole('textbox', { name: 'Answer entry' })).toBeFocused();

  // insertText sends no key events, like an on-screen keyboard or swipe typing.
  await page.keyboard.insertText('Desdemona');
  await expect(square(page, 5)).toHaveAccessibleName(/, e$/);
  await expect(square(page, 152)).toHaveAccessibleName(/, a$/);

  // An on-screen Backspace on Android: a delete input event, no usable key event.
  await page.getByRole('textbox', { name: 'Answer entry' }).evaluate((el) => {
    el.dispatchEvent(
      new InputEvent('beforeinput', { inputType: 'deleteContentBackward', cancelable: true }),
    );
  });
  await expect(square(page, 152)).toHaveAccessibleName(/, empty$/);
});

test('the page does not jump around when tapping squares', async ({ page }) => {
  await startSampleRoom(page);
  await square(page, 1).tap();
  const before = await page.evaluate(() => window.scrollY);
  await square(page, 2).tap();
  expect(Math.abs((await page.evaluate(() => window.scrollY)) - before)).toBeLessThan(50);
});
