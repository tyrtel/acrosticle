import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeBackend } from '../../../tests/support/fakeBackend';
import { MyPuzzles } from './MyPuzzles';
import { SessionProvider } from './SessionProvider';

let backend: FakeBackend;
beforeEach(() => {
  backend = new FakeBackend();
  backend.install();
});

const renderPage = () =>
  render(
    <SessionProvider>
      <MyPuzzles />
    </SessionProvider>,
  );

describe('MyPuzzles', () => {
  it('asks visitors to sign in', async () => {
    renderPage();
    expect(
      await screen.findByText("Sign in to see the puzzles you've created."),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign in with Google' })).toBeInTheDocument();
  });

  it('says when there are no rooms yet', async () => {
    backend.signIn();
    renderPage();
    expect(
      await screen.findByText("You haven't created any puzzle rooms yet."),
    ).toBeInTheDocument();
  });

  it('lists rooms newest first, linking to each', async () => {
    backend.signIn();
    backend.myRooms.push(
      { roomId: 'Older00000000000000000', title: 'Older', createdAt: Date.UTC(2026, 9, 1) },
      { roomId: 'Newer00000000000000000', title: null, createdAt: Date.UTC(2026, 10, 1) },
    );
    renderPage();
    const links = await screen.findAllByRole('link');
    expect(links.map((l) => [l.textContent, l.getAttribute('href')])).toEqual([
      ['Untitled puzzle', '/r/Newer00000000000000000'],
      ['Older', '/r/Older00000000000000000'],
    ]);
  });

  it('shows a load error', async () => {
    backend.signIn();
    const fetchMock = vi.mocked(globalThis.fetch);
    const original = fetchMock.getMockImplementation();
    fetchMock.mockImplementation((url, init) =>
      url === '/api/me/rooms'
        ? Promise.resolve(
            new Response(JSON.stringify({ error: 'Database is down.' }), { status: 500 }),
          )
        : (original as typeof fetch)(url, init),
    );
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('Database is down.');
  });
});
