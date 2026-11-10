import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App';
import { FakeBackend } from '../support/fakeBackend';
import { samplePuzzleFileAsPrinted } from '../support/samples';

let backend: FakeBackend;
beforeEach(() => {
  backend = new FakeBackend();
  backend.install();
});

describe('importing, fixing and solving a puzzle', () => {
  it('goes from a pasted file with a misprint to a shared room', async () => {
    backend.signIn();
    window.localStorage.setItem('acrosticle:name', 'Ada');
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole('button', { name: 'Import a puzzle file' }));
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
    backend.failNextCreate = { status: 503, error: 'The server is busy. Try again soon.' };
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Try the sample puzzle' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The server is busy. Try again soon.',
    );
    expect(window.location.pathname).toBe('/');
  });

  it('lists the new room under My puzzles', async () => {
    backend.signIn();
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Try the sample puzzle' }));
    await screen.findByLabelText(/Your name/);

    await user.click(screen.getByRole('button', { name: 'My puzzles' }));
    expect(window.location.search).toBe('?panel=my');
    const panel = screen.getByRole('dialog', { name: 'My puzzles' });
    const link = await within(panel).findByRole('link', { name: 'Diplo-Crostic No. 37' });
    expect(link).toHaveAttribute('href', '/r/Created000000000000001');
    expect(within(panel).getByText('Created by you')).toBeInTheDocument();

    // Opening a puzzle from the panel closes it.
    await user.click(link);
    expect(window.location.search).toBe('');
    expect(panel).not.toHaveAttribute('open');
  });

  it('reads an uploaded image, shows notes, and starts a room from the reviewed draft', async () => {
    backend.signIn();
    backend.parseReply = {
      status: 200,
      body: {
        file: samplePuzzleFileAsPrinted(),
        notes: ['Square 193 looked like 193Y.'],
        issues: [],
        needsFixes: true,
        costUsd: 0.4,
      },
    };
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole('button', { name: 'Upload a puzzle image' }));
    // jsdom can't decode images, so skip the real downscale: upload a tiny PNG as-is.
    vi.stubGlobal('createImageBitmap', () =>
      Promise.resolve({ width: 10, height: 10, close: () => {} }),
    );
    await user.upload(
      screen.getByLabelText('Choose an image'),
      new File([new Uint8Array(10)], 'puzzle.png', { type: 'image/png' }),
    );
    await user.click(screen.getByRole('button', { name: 'Read the puzzle' }));

    expect(await screen.findByRole('heading', { name: 'Review the puzzle' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Notes from reading the image' })).toHaveTextContent(
      'Square 193 looked like 193Y.',
    );
    await user.click(screen.getByRole('button', { name: 'Fix' }));
    await user.click(screen.getByRole('button', { name: 'Start solving' }));
    expect(
      await screen.findByRole('heading', { name: 'Diplo-Crostic No. 37' }),
    ).toBeInTheDocument();
  });
});
