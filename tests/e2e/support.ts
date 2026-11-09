import { expect, type Page } from '@playwright/test';

export const square = (page: Page, n: number) =>
  page.getByRole('gridcell', { name: new RegExp(`^Square ${n}, clue [A-Z]+, `) });

export const blank = (page: Page, n: number) =>
  page.getByRole('gridcell', {
    name: new RegExp(`^Clue [A-Z]+, letter \\d+ of \\d+, square ${n}, `),
  });

/** Joins the room the page is on, under the given name. */
export async function join(page: Page, name: string): Promise<void> {
  await page.getByLabel(/Your name/).fill(name);
  await page.getByRole('button', { name: 'Join' }).click();
  await expect(page.getByRole('status')).toHaveText('Live');
}

/** Creates a room for the sample puzzle from the home page and joins it. */
export async function startSampleRoom(page: Page, name = 'Ada'): Promise<string> {
  await page.goto('/');
  await page.getByRole('button', { name: 'Try the sample puzzle' }).click();
  await page.waitForURL(/\/r\/[A-Za-z0-9_-]{22}$/);
  await join(page, name);
  return page.url();
}
