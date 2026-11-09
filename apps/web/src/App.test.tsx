import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { FakeBackend } from '../tests/support/fakeBackend';
import { App } from './App';

let backend: FakeBackend;
beforeEach(() => {
  backend = new FakeBackend();
  backend.install();
});

const importButton = () => screen.getByRole('button', { name: 'Import a puzzle file' });

describe('App', () => {
  it('renders the home page', async () => {
    render(<App />);
    expect(screen.getByRole('heading', { level: 1, name: 'Acrosticle' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try the sample puzzle' })).toBeEnabled();
    // One in the header, one next to the disabled Import button.
    expect(await screen.findAllByRole('link', { name: 'Sign in with Google' })).toHaveLength(2);
  });

  it('shows a not-found message for unknown addresses', () => {
    window.history.replaceState(null, '', '/nowhere');
    render(<App />);
    expect(screen.getByRole('alert')).toHaveTextContent("There's nothing at this address.");
  });

  it('asks visitors to sign in before importing', async () => {
    render(<App />);
    expect(
      await screen.findByText('Sign in to import your own puzzles. The sample needs no account.'),
    ).toBeInTheDocument();
    expect(importButton()).toBeDisabled();
  });

  it('explains when a signed-in account is not on the allowlist', async () => {
    backend.signIn({ canCreate: false, email: 'cy@example.com' });
    render(<App />);
    expect(
      await screen.findByText(/Your account \(cy@example\.com\) isn't enabled/),
    ).toBeInTheDocument();
    expect(importButton()).toBeDisabled();
  });

  it('lets allowlisted accounts import', async () => {
    backend.signIn();
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('Ada Lovelace');
    expect(importButton()).toBeEnabled();
    await user.click(importButton());
    expect(screen.getByRole('heading', { name: 'Import a puzzle file' })).toBeInTheDocument();
  });

  it('starts sample rooms without signing in', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Try the sample puzzle' }));
    expect(window.location.pathname).toBe('/r/Created000000000000001');
  });
});
