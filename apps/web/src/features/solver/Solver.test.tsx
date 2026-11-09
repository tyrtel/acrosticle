import { parseCompactGrid, type Puzzle } from '@acrosticle/core';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Solver } from './Solver';

//   1A 2B  #  3A
//   4B  #  5A
// Clue A = 3, 1, 5. Clue B = 4, 2.
function tinyPuzzle(): Puzzle {
  const grid = parseCompactGrid(4, ['1A 2B # 3A', '4B # 5A']);
  if (!grid.ok) throw new Error(grid.error);
  return {
    title: 'Tiny',
    constructedBy: 'Tester',
    grid: grid.grid,
    clues: [
      { label: 'A', text: 'First clue', cells: [3, 1, 5] },
      { label: 'B', text: 'Second clue', cells: [4, 2] },
    ],
  };
}

const square = (n: number) =>
  screen.getByRole('gridcell', { name: new RegExp(`^Square ${n}, clue [A-Z]+, `) });
const blank = (n: number) =>
  screen.getByRole('gridcell', {
    name: new RegExp(`^Clue [A-Z]+, letter \\d+ of \\d+, square ${n}, `),
  });

function setup() {
  const user = userEvent.setup();
  render(<Solver puzzle={tinyPuzzle()} />);
  return {
    user,
    grid: screen.getByRole('grid', { name: 'Quotation grid' }),
    clues: screen.getByRole('grid', { name: 'Clues' }),
  };
}

describe('Solver', () => {
  it('shows the title, byline, grid and clues', () => {
    setup();
    expect(screen.getByRole('heading', { name: 'Tiny' })).toBeInTheDocument();
    expect(screen.getByText('By Tester')).toBeInTheDocument();
    expect(screen.getAllByRole('gridcell', { name: 'Black square' })).toHaveLength(2);
    expect(screen.getByRole('rowheader', { name: 'A. First clue' })).toBeInTheDocument();
    expect(screen.getByText('0 / 5 squares filled')).toBeInTheDocument();
  });

  it('starts with the first grid square selected', () => {
    const { grid } = setup();
    expect(square(1)).toHaveAttribute('aria-selected', 'true');
    expect(grid).toHaveAttribute('aria-activedescendant', square(1).id);
  });

  it('typing in the grid fills the matching clue blanks', async () => {
    const { user } = setup();
    await user.click(square(1));
    await user.keyboard('xy');

    expect(square(1)).toHaveAccessibleName('Square 1, clue A, X');
    expect(blank(1)).toHaveAccessibleName('Clue A, letter 2 of 3, square 1, X');
    expect(blank(2)).toHaveAccessibleName('Clue B, letter 2 of 2, square 2, Y');
    expect(square(3)).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('2 / 5 squares filled')).toBeInTheDocument();
  });

  it('typing in a clue fills the matching grid squares, in answer order', async () => {
    const { user, clues } = setup();
    await user.click(blank(3));
    await user.keyboard('abc');

    expect(square(3)).toHaveAccessibleName('Square 3, clue A, A');
    expect(square(1)).toHaveAccessibleName('Square 1, clue A, B');
    expect(square(5)).toHaveAccessibleName('Square 5, clue A, C');
    expect(clues).toHaveFocus();
  });

  it('shows the acrostic as first letters are filled', async () => {
    const { user } = setup();
    await user.click(blank(3));
    await user.keyboard('d');
    expect(screen.getByLabelText('First letters: D blank')).toBeInTheDocument();
  });

  it('Enter switches between the grid and the clues, keeping the square', async () => {
    const { user, grid, clues } = setup();
    await user.click(square(2));
    await user.keyboard('{Enter}');
    expect(clues).toHaveFocus();
    expect(clues).toHaveAttribute('aria-activedescendant', blank(2).id);

    await user.keyboard('{Enter}');
    expect(grid).toHaveFocus();
  });

  it('Tab jumps to the next clue', async () => {
    const { user } = setup();
    await user.click(square(1));
    await user.keyboard('{Tab}');
    expect(blank(4)).toHaveAttribute('aria-selected', 'true');
  });

  it('Tab past the last clue leaves the solver instead of trapping focus', async () => {
    const { user, clues } = setup();
    await user.click(blank(4));
    await user.keyboard('{Tab}');
    expect(clues).not.toHaveFocus();
    expect(blank(4)).toHaveAttribute('aria-selected', 'true');
  });

  it('Shift+Tab before the first clue leaves the solver too', async () => {
    const { user, clues } = setup();
    await user.click(blank(3));
    await user.keyboard('{Shift>}{Tab}{/Shift}');
    expect(clues).not.toHaveFocus();
  });

  it('arrow keys move around the grid', async () => {
    const { user } = setup();
    await user.click(square(1));
    await user.keyboard('{ArrowDown}');
    expect(square(4)).toHaveAttribute('aria-selected', 'true');
  });

  it('Backspace clears and moves back', async () => {
    const { user } = setup();
    await user.click(square(1));
    await user.keyboard('xy{Backspace}{Backspace}');
    expect(square(1)).toHaveAccessibleName('Square 1, clue A, empty');
    expect(square(2)).toHaveAccessibleName('Square 2, clue B, empty');
  });

  it('highlights the current clue', async () => {
    const { user } = setup();
    await user.click(square(2));
    const rows = within(screen.getByRole('grid', { name: 'Clues' })).getAllByRole('row');
    expect(rows[1]?.className).toMatch(/current/);
    expect(rows[0]?.className).not.toMatch(/current/);
  });
});
