import { expect, test } from '@playwright/test';
import { blank, join, square, startSampleRoom } from './support';

test('two people solve the same puzzle together', async ({ browser }) => {
  const ada = await (await browser.newContext()).newPage();
  const bo = await (await browser.newContext()).newPage();

  const roomUrl = await startSampleRoom(ada, 'Ada');
  await bo.goto(roomUrl);
  await join(bo, 'Bo');

  // Both see both people.
  for (const page of [ada, bo]) {
    const people = page.getByRole('list', { name: 'People in this room' });
    await expect(people).toContainText('Ada');
    await expect(people).toContainText('Bo');
  }

  // Ada types clue A; Bo sees it in his grid.
  await blank(ada, 138).click();
  await ada.keyboard.type('DESDEMONA');
  await expect(bo.getByRole('gridcell', { name: 'Square 5, clue A, E' })).toBeVisible();

  // Bo types in his grid; Ada sees it in her clue list.
  await square(bo, 1).click();
  await bo.keyboard.type('M');
  await expect(
    ada.getByRole('gridcell', { name: 'Clue O, letter 3 of 7, square 1, M' }),
  ).toBeVisible();

  // Ada sees Bo's cursor (he moved on to square 2 after typing), and hovering
  // it shows his initial in his color.
  await expect(square(ada, 2)).toHaveCSS('outline-style', 'solid');
  await expect(square(ada, 2)).toHaveAccessibleName(/Bo is here$/);
  await square(ada, 2).hover();
  await expect(square(ada, 2).getByText('B', { exact: true })).toBeVisible();
});

test('letters are still there after reloading', async ({ page }) => {
  await startSampleRoom(page);
  await blank(page, 138).click();
  await page.keyboard.type('DES');
  await expect(page.getByRole('gridcell', { name: 'Square 44, clue A, S' })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('status')).toHaveText('Live');
  await expect(page.getByRole('gridcell', { name: 'Square 44, clue A, S' })).toBeVisible();
});

test('a mistyped room link explains the problem', async ({ page }) => {
  await page.goto('/r/AAAAAAAAAAAAAAAAAAAAAA');
  await expect(page.getByRole('heading', { name: 'Room not found' })).toBeVisible();
});

test('a multi-letter entry reaches everyone in the room', async ({ browser, isMobile }) => {
  const ada = await (await browser.newContext()).newPage();
  const bo = await (await browser.newContext()).newPage();
  const roomUrl = await startSampleRoom(ada, 'Ada');
  await bo.goto(roomUrl);
  await join(bo, 'Bo');

  await square(ada, 3).click();
  if (isMobile) {
    // Phones have no Shift+Enter or Insert: use the button.
    await ada.getByRole('button', { name: 'Multi-letter' }).click();
  } else {
    await ada.keyboard.press('Shift+Enter');
  }
  const box = ada.getByRole('textbox', { name: 'Multi-letter entry' });
  await expect(box).toBeVisible();
  await box.pressSequentially('E or I');
  await ada.keyboard.press('Enter');

  await expect(bo.getByRole('gridcell', { name: 'Square 3, clue P, E or I' })).toBeVisible();
  await expect(square(bo, 3)).toContainText('E or');
});
