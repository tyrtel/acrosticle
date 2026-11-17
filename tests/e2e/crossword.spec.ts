import { expect, test, type Page } from '@playwright/test';
import { join } from './support';

/** Squares by position, e.g. "row 3, column 1" (with the clue number first where printed). */
const at = (page: Page, row: number, column: number) =>
  page.getByRole('gridcell', { name: new RegExp(`row ${row}, column ${column},`) });

async function startSampleCrossword(page: Page, name = 'Ada'): Promise<string> {
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Crosswordicle' })).toBeVisible();
  await page.getByRole('button', { name: 'Try the sample crossword' }).click();
  await page.waitForURL(/\/r\/[A-Za-z0-9_-]{22}$/);
  await join(page, name);
  return page.url();
}

test('two people solve the sample crossword together, across and down', async ({ browser }) => {
  const ada = await (await browser.newContext()).newPage();
  const bo = await (await browser.newContext()).newPage();
  const roomUrl = await startSampleCrossword(ada, 'Ada');
  await bo.goto(roomUrl);
  await join(bo, 'Bo');

  // Ada types 6 Across; it stops at the end of the word.
  await at(ada, 3, 1).click();
  await ada.keyboard.type('SLATE');
  // Ada's cursor stays on the word's last square, so Bo sees her there.
  await expect(at(bo, 3, 5)).toHaveAccessibleName('7, row 3, column 5, E, Ada is here');

  // Bo switches to down with an arrow (without moving) and types 3 Down over Ada's letters.
  await at(bo, 1, 3).click();
  await bo.keyboard.press('ArrowDown');
  await expect(bo.getByRole('button', { name: /^Typing down/ })).toBeVisible();
  await bo.keyboard.type('SL');
  await expect(at(ada, 2, 3)).toHaveAccessibleName('row 2, column 3, L');
  await expect(at(ada, 1, 3)).toHaveAccessibleName('3, row 1, column 3, S');
  // Bo's cursor moved down to the next empty square of 3 Down (row 3 is Ada's SLATE).
  await expect(at(ada, 4, 3)).toHaveAccessibleName('row 4, column 3, empty, Bo is here');
});

test('clicking a clue moves there, and highlights reach the other solver', async ({
  browser,
  isMobile,
}) => {
  const ada = await (await browser.newContext()).newPage();
  const bo = await (await browser.newContext()).newPage();
  const roomUrl = await startSampleCrossword(ada, 'Ada');
  await bo.goto(roomUrl);
  await join(bo, 'Bo');

  await ada.getByRole('button', { name: '9 Across: Corn unit' }).click();
  await expect(ada.getByRole('button', { name: /^Typing across/ })).toBeVisible();
  if (isMobile) await ada.getByRole('button', { name: 'Highlight' }).click();
  else await ada.keyboard.press('Control+h');
  await expect(at(bo, 5, 3)).toHaveAccessibleName(
    '9, row 5, column 3, empty, highlighted, Ada is here',
  );
});

/** Starts a room for one of the test samples (the e2e servers let guests start samples). */
async function startTestSample(page: Page, sample: string): Promise<void> {
  await page.goto('/');
  const roomId = await page.evaluate(async (id) => {
    const res = await fetch('/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sample: id }),
    });
    return ((await res.json()) as { roomId: string }).roomId;
  }, sample);
  await page.goto(`/r/${roomId}`);
  await join(page, 'Ada');
}

test('a barred crossword: bars end the words, and instructions are shown', async ({ page }) => {
  await startTestSample(page, 'gridicles-barred-1');
  await expect(page.getByText('A barred grid: thick lines end the words.')).toBeVisible();
  // 1 Across is two squares: typing stops at the bar after square 2. (Square 1 starts
  // selected, and clicking it would switch to down, so start on square 2.)
  await at(page, 1, 2).click();
  await page.keyboard.type('YZ');
  await expect(at(page, 1, 2)).toHaveAccessibleName(/row 1, column 2, Z/);
  await expect(at(page, 1, 3)).toHaveAccessibleName(/row 1, column 3, empty/);
});

test('a rows-and-columns crossword: typing runs along the whole row', async ({ page }) => {
  await startTestSample(page, 'gridicles-rows-1');
  await expect(page.getByRole('region', { name: 'Rows clues' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Column B: / })).toBeVisible();
  await at(page, 1, 2).click();
  await page.keyboard.type('BCD');
  await expect(at(page, 1, 4)).toHaveAccessibleName(/row 1, column 4, D/);
});
