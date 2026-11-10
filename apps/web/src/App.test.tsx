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

describe('App', () => {
  it('renders the home page', () => {
    render(<App />);
    expect(screen.getByRole('heading', { level: 1, name: 'Acrosticle' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try the sample puzzle' })).toBeInTheDocument();
  });

  it('shows a not-found message for unknown addresses', () => {
    window.history.replaceState(null, '', '/nowhere');
    render(<App />);
    expect(screen.getByRole('alert')).toHaveTextContent("There's nothing at this address.");
  });

  it('"New puzzle" returns to a fresh start screen from anywhere', async () => {
    backend.signIn();
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole('button', { name: 'Import a puzzle file' }));
    expect(screen.getByRole('heading', { name: 'Import a puzzle file' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'New puzzle' }));
    expect(screen.getByRole('button', { name: 'Try the sample puzzle' })).toBeInTheDocument();

    window.history.pushState(null, '', '/nowhere');
    window.dispatchEvent(new PopStateEvent('popstate'));
    await user.click(await screen.findByRole('button', { name: 'New puzzle' }));
    expect(window.location.pathname).toBe('/');
  });

  it('shows My puzzles only to signed-in users, and opens the panel', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<App />);
    await screen.findAllByRole('link', { name: 'Sign in with Google' });
    expect(screen.queryByRole('button', { name: 'My puzzles' })).toBeNull();
    unmount();

    backend.signIn();
    render(<App />);
    await user.click(await screen.findByRole('button', { name: 'My puzzles' }));
    expect(screen.getByRole('dialog', { name: 'My puzzles' })).toHaveAttribute('open');
  });

  it('turns old /my links into the panel', async () => {
    window.history.replaceState(null, '', '/my');
    render(<App />);
    expect(await screen.findByRole('dialog', { name: 'My puzzles' })).toHaveAttribute('open');
    expect(window.location.pathname + window.location.search).toBe('/?panel=my');
  });

  it('cycles the theme from the header: System → Light → Dark', async () => {
    const user = userEvent.setup();
    render(<App />);
    const button = screen.getByRole('button', { name: /^Theme: System/ });
    await user.click(button);
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(button).toHaveAccessibleName('Theme: Light. Switch to Dark.');
    await user.click(button);
    expect(document.documentElement.dataset.theme).toBe('dark');
    await user.click(button);
    expect(document.documentElement.dataset.theme).toBeUndefined();
  });
});
