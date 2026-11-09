import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../../src/App';
import { FakeBackend } from '../support/fakeBackend';
import { samplePuzzleFileAsPrinted } from '../support/samples';

beforeEach(() => new FakeBackend().install());

describe('importing, fixing and solving a puzzle', () => {
  it('goes from a pasted file with a misprint to a shared room', async () => {
    window.localStorage.setItem('acrosticle:name', 'Ada');
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

    expect(
      await screen.findByRole('heading', { name: 'Diplo-Crostic No. 37' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('gridcell', { name: 'Square 193, clue V, empty' })).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'Acrosticle' }));
    expect(screen.getByRole('button', { name: 'Try the sample puzzle' })).toBeInTheDocument();
  });

  it('shows why a room could not be created', async () => {
    const user = userEvent.setup();
    render(<App />);
    const fetchMock = globalThis.fetch as unknown as {
      mockImplementationOnce: (fn: () => Promise<Response>) => void;
    };
    fetchMock.mockImplementationOnce(() =>
      Promise.resolve(
        new Response(JSON.stringify({ error: 'Sign in to create a puzzle room.' }), {
          status: 401,
        }),
      ),
    );
    await user.click(screen.getByRole('button', { name: 'Try the sample puzzle' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Sign in to create a puzzle room.');
    expect(window.location.pathname).toBe('/');
  });
});
