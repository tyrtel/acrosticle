import { expect, test } from '@playwright/test';
import { blank, square, startSampleRoom } from './support';

test('Copy to Sheet puts the grids and clues, with letters and highlights, on the clipboard', async ({
  page,
  context,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'Reading the clipboard back needs Chromium permissions');
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await startSampleRoom(page);

  // Clue A's answer starts at square 138, then 5.
  await blank(page, 138).click();
  await page.keyboard.type('DE');
  await square(page, 5).click({ modifiers: ['ControlOrMeta'] });
  await page.getByRole('button', { name: 'Copy to Sheet' }).click();
  await expect(page.getByRole('button', { name: 'Copied!' })).toBeVisible();

  const { html, text } = await page.evaluate(async () => {
    const [item] = await navigator.clipboard.read();
    if (!item) throw new Error('nothing copied');
    return {
      html: await (await item.getType('text/html')).text(),
      text: await (await item.getType('text/plain')).text(),
    };
  });
  expect(html).toContain('<google-sheets-html-origin>');
  expect(html).toContain('A. Daughter to Brabantio');
  expect(html).toContain('data-sheets-formula="=R[');
  expect(html).toContain('background:#bfe8c4');
  expect(text.split('\n')[0]).toMatch(/^1O\t2E\t3P\t/);
  expect(text).toContain('A. Daughter to Brabantio');
});
