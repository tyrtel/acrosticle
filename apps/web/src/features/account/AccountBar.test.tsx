import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { FakeBackend } from '../../../tests/support/fakeBackend';
import { AccountBar } from './AccountBar';
import { SessionProvider } from './SessionProvider';

let backend: FakeBackend;
beforeEach(() => {
  backend = new FakeBackend();
  backend.install();
});

const renderBar = () =>
  render(
    <SessionProvider>
      <AccountBar />
    </SessionProvider>,
  );

describe('AccountBar', () => {
  it('offers sign-in, returning to the current page', async () => {
    window.history.replaceState(null, '', '/r/abc?x=1');
    renderBar();
    expect(await screen.findByRole('link', { name: 'Sign in with Google' })).toHaveAttribute(
      'href',
      '/api/auth/google?returnTo=%2Fr%2Fabc%3Fx%3D1',
    );
  });

  it('explains when sign-in is not set up', async () => {
    backend.me = { ...backend.me, signInConfigured: false };
    renderBar();
    expect(await screen.findByRole('button', { name: 'Sign in with Google' })).toBeDisabled();
    expect(screen.getByText("Sign-in isn't set up on this server yet.")).toBeInTheDocument();
  });

  it('shows the signed-in user with a privacy-safe photo, and signs out', async () => {
    backend.signIn({ picture: 'https://example.com/ada.png' });
    const user = userEvent.setup();
    const { container } = renderBar();
    expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument();
    const photo = container.querySelector('img');
    expect(photo).toHaveAttribute('src', 'https://example.com/ada.png');
    expect(photo).toHaveAttribute('referrerpolicy', 'no-referrer');
    expect(screen.getByRole('link', { name: 'My puzzles' })).toHaveAttribute('href', '/my');

    await user.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(await screen.findByRole('link', { name: 'Sign in with Google' })).toBeInTheDocument();
    expect(backend.me.user).toBeNull();
  });

  it('treats an unreachable server as signed out', async () => {
    const { vi } = await import('vitest');
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new TypeError('offline'))),
    );
    renderBar();
    expect(await screen.findByRole('button', { name: 'Sign in with Google' })).toBeDisabled();
  });
});
