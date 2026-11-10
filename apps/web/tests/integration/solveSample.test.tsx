import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../../src/App';
import { FakeBackend } from '../support/fakeBackend';

const square = (n: number) =>
  screen.getByRole('gridcell', { name: new RegExp(`^Square ${n}, clue [A-Z]+, `) });
const blank = (n: number) =>
  screen.getByRole('gridcell', {
    name: new RegExp(`^Clue [A-Z]+, letter \\d+ of \\d+, square ${n}, `),
  });

let backend: FakeBackend;
beforeEach(() => {
  backend = new FakeBackend();
  backend.install();
});

describe('solving the sample puzzle', () => {
  it('creates a room for the sample, joins it, and solves across both views', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Try the sample puzzle' }));
    expect(window.location.pathname).toMatch(/^\/r\/Created0+1$/);

    await user.type(await screen.findByLabelText(/Your name/), 'Ada');
    await user.click(screen.getByRole('button', { name: 'Join' }));
    expect(
      await screen.findByRole('heading', { name: 'Diplo-Crostic No. 37' }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('gridcell', { name: /^Square \d+,/ })).toHaveLength(232);

    // Clue A, "Daughter to Brabantio": its first blank is square 138.
    await user.click(blank(138));
    await user.keyboard('DESDEMONA');
    expect(square(5)).toHaveAccessibleName('Square 5, clue A, E');
    expect(square(232)).toHaveAccessibleName('Square 232, clue A, D');

    // Now type in the grid: squares 1-4 are clues O, E, P and D.
    await user.click(square(1));
    await user.keyboard('MDTN');
    expect(blank(2)).toHaveAccessibleName('Clue E, letter 4 of 9, square 2, D');
    expect(screen.getByText('13 / 232 squares filled')).toBeInTheDocument();

    // Everything typed reached the room.
    expect(backend.rooms.get('Created000000000000001')?.cells.size).toBe(13);
  });
});
