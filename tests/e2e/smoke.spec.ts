import { expect, test } from '@playwright/test';
import { blank, square, startSampleRoom } from './support';

test('home page loads', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Acrosticle' })).toBeVisible();
});

test('solving the sample fills the grid from a clue', async ({ page }) => {
  await startSampleRoom(page);
  await expect(page.getByRole('heading', { name: 'Diplo-Crostic No. 37' })).toBeVisible();

  // Clue A's first blank is square 138; its second is grid square 5.
  await blank(page, 138).click();
  await page.keyboard.type('DESDEMONA');
  await expect(page.getByRole('gridcell', { name: 'Square 5, clue A, E' })).toBeVisible();
});

test('grid squares are laid out in rows, like the printed grid', async ({ page }) => {
  await startSampleRoom(page);

  const box = async (n: number) => {
    const b = await square(page, n).boundingBox();
    if (!b) throw new Error(`square ${n} is not visible`);
    return b;
  };
  // Row 1 starts "1O 2E ..."; row 2 starts with square 19.
  const [s1, s2, s19] = [await box(1), await box(2), await box(19)];
  expect(s2.x).toBeGreaterThanOrEqual(s1.x + s1.width - 1);
  expect(Math.abs(s2.y - s1.y)).toBeLessThan(1);
  expect(s19.y).toBeGreaterThanOrEqual(s1.y + s1.height - 1);
  expect(Math.abs(s19.x - s1.x)).toBeLessThan(1);
});
