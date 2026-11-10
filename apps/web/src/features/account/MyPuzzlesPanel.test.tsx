import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeBackend } from '../../../tests/support/fakeBackend';
import { MyPuzzlesPanel } from './MyPuzzlesPanel';
import { SessionProvider } from './SessionProvider';

const tiny = {
  title: 'Tiny',
  grid: { columns: 1, rows: ['1A'] },
  clues: [{ label: 'A', text: 'x', cells: [1] }],
};

let backend: FakeBackend;
beforeEach(() => {
  backend = new FakeBackend();
  backend.install();
});

function addMine(roomId: string, title: string, updatedAt: number, createdByMe = true) {
  backend.addRoom({ ...tiny, title }, roomId);
  backend.myRooms.push({ roomId, title, createdAt: updatedAt, updatedAt, createdByMe });
}

function setup(props: Partial<Parameters<typeof MyPuzzlesPanel>[0]> = {}) {
  const user = userEvent.setup();
  const onClose = vi.fn();
  const onNewPuzzle = vi.fn();
  render(
    <SessionProvider>
      <MyPuzzlesPanel open onClose={onClose} onNewPuzzle={onNewPuzzle} {...props} />
    </SessionProvider>,
  );
  return { user, onClose, onNewPuzzle, panel: screen.getByRole('dialog', { name: 'My puzzles' }) };
}

describe('MyPuzzlesPanel', () => {
  it('asks signed-out visitors to sign in', async () => {
    setup();
    expect(await screen.findByText(/Sign in to see the puzzles/)).toBeInTheDocument();
  });

  it('lists created and joined puzzles, most recently active first, marking your own', async () => {
    backend.signIn();
    const now = Date.now();
    addMine('Older00000000000000000', 'Older, mine', now - 3 * 60 * 60 * 1000);
    addMine('Joined0000000000000000', 'Joined', now - 5 * 60 * 1000, false);
    const { panel } = setup();

    const items = await within(panel).findAllByRole('listitem');
    expect(items.map((item) => within(item).getByRole('link').textContent)).toEqual([
      'Joined',
      'Older, mine',
    ]);
    expect(items[0]).toHaveTextContent('Active 5 minutes ago');
    expect(within(items[0]!).queryByText('Created by you')).toBeNull();
    expect(within(items[1]!).getByText('Created by you')).toBeInTheDocument();
    expect(within(items[0]!).queryByRole('button', { name: /Delete/ })).toBeNull();
  });

  it('copies a puzzle link', async () => {
    backend.signIn();
    addMine('Room0000000000000000AB', 'Mine', Date.now());
    const { user } = setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText');

    await user.click(await screen.findByRole('button', { name: 'Copy link to Mine' }));
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/r/Room0000000000000000AB`);
    expect(screen.getByRole('button', { name: 'Copy link to Mine' })).toHaveTextContent('Copied!');
  });

  it('deletes a puzzle after confirming, and can cancel', async () => {
    backend.signIn();
    addMine('Room0000000000000000AB', 'Mine', Date.now());
    const { user } = setup();

    await user.click(await screen.findByRole('button', { name: 'Delete Mine' }));
    expect(screen.getByText(/for everyone\? All progress will be lost/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(backend.rooms.has('Room0000000000000000AB')).toBe(true);

    await user.click(screen.getByRole('button', { name: 'Delete Mine' }));
    await user.click(screen.getByRole('button', { name: 'Delete for everyone' }));
    expect(await screen.findByText(/No puzzles yet/)).toBeInTheDocument();
    expect(backend.rooms.has('Room0000000000000000AB')).toBe(false);
  });

  it('explains a failed delete', async () => {
    backend.signIn();
    addMine('Room0000000000000000AB', 'Mine', Date.now());
    const { user } = setup();
    const deleteButton = await screen.findByRole('button', { name: 'Delete Mine' });
    backend.myRooms[0] = { ...backend.myRooms[0]!, createdByMe: false }; // server now disagrees

    await user.click(deleteButton);
    await user.click(screen.getByRole('button', { name: 'Delete for everyone' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Only the creator can delete it.');
  });

  it('closes from the close button, the backdrop, or a New puzzle click', async () => {
    const { user, onClose, onNewPuzzle, panel } = setup();
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalled();

    onClose.mockClear();
    await user.click(panel); // the <dialog> itself is the backdrop area
    expect(onClose).toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: '+ New puzzle' }));
    expect(onNewPuzzle).toHaveBeenCalledOnce();
  });
});
