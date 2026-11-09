import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '../../src/App';

const square = (n: number) =>
  screen.getByRole('gridcell', { name: new RegExp(`^Square ${n}, clue [A-Z]+, `) });
const blank = (n: number) =>
  screen.getByRole('gridcell', {
    name: new RegExp(`^Clue [A-Z]+, letter \\d+ of \\d+, square ${n}, `),
  });

describe('solving the sample puzzle', () => {
  it('opens the sample and solves across both views', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Try the sample puzzle' }));
    expect(screen.getByRole('heading', { name: 'Diplo-Crostic No. 37' })).toBeInTheDocument();
    expect(screen.getAllByRole('gridcell', { name: /^Square \d+,/ })).toHaveLength(232);

    // Clue A, "Daughter to Brabantio": its first blank is square 138.
    await user.click(blank(138));
    await user.keyboard('desdemona');

    // Square 5 (clue A's second blank) sits in the grid's first row.
    expect(square(5)).toHaveAccessibleName('Square 5, clue A, E');
    expect(square(232)).toHaveAccessibleName('Square 232, clue A, D');

    // Now type in the grid: squares 1-4 are clues O, E, P and D.
    await user.click(square(1));
    await user.keyboard('mdtn');
    expect(blank(2)).toHaveAccessibleName('Clue E, letter 4 of 9, square 2, D');
    expect(screen.getByText('13 / 232 squares filled')).toBeInTheDocument();
  });
});
