import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '../../src/App';
import { samplePuzzleFileAsPrinted } from '../support/samples';

describe('importing, fixing and solving a puzzle', () => {
  it('goes from a pasted file with a misprint to a solvable puzzle', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Import a puzzle file' }));
    await user.click(screen.getByLabelText('Or paste the file contents'));
    await user.paste(JSON.stringify(samplePuzzleFileAsPrinted()));
    await user.click(screen.getByRole('button', { name: 'Load puzzle' }));

    expect(screen.getByRole('heading', { name: 'Review the puzzle' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start solving' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Fix' }));
    await user.click(screen.getByRole('button', { name: 'Start solving' }));

    expect(screen.getByRole('heading', { name: 'Diplo-Crostic No. 37' })).toBeInTheDocument();
    expect(screen.getByRole('gridcell', { name: 'Square 193, clue V, empty' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '← Home' }));
    expect(screen.getByRole('button', { name: 'Try the sample puzzle' })).toBeInTheDocument();
  });
});
