import type { Letter } from '@acrosticle/core';
import type { PuzzleFile } from '@acrosticle/protocol';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { FakeBackend, type FakeRoom } from '../../../tests/support/fakeBackend';
import { SessionProvider } from '../account';
import { RoomPage } from './RoomPage';

const ROOM_ID = 'TinyRoom00000000000000';
const tiny: PuzzleFile = {
  title: 'Tiny',
  grid: { columns: 4, rows: ['1A 2B # 3A', '4B # 5A'] },
  clues: [
    { label: 'A', text: 'First', cells: [3, 1, 5] },
    { label: 'B', text: 'Second', cells: [4, 2] },
  ],
};

const square = (n: number) =>
  screen.getByRole('gridcell', { name: new RegExp(`^Square ${n}, clue [A-Z]+, `) });

let backend: FakeBackend;
let room: FakeRoom;

beforeEach(() => {
  backend = new FakeBackend();
  room = backend.addRoom(tiny, ROOM_ID);
  backend.install();
});

async function joinAs(name: string) {
  const user = userEvent.setup();
  render(<RoomPage roomId={ROOM_ID} />);
  await user.type(await screen.findByLabelText(/Your name/), name);
  await user.click(screen.getByRole('button', { name: 'Join' }));
  await screen.findByRole('grid', { name: 'Quotation grid' });
  return user;
}

describe('RoomPage', () => {
  it('says so when the room does not exist', async () => {
    render(<RoomPage roomId="NoSuchRoom000000000000" />);
    expect(await screen.findByRole('heading', { name: 'Room not found' })).toBeInTheDocument();
  });

  it('asks for a name, then joins and shows the puzzle and members', async () => {
    await joinAs('Ada');
    expect(screen.getByRole('heading', { name: 'Tiny' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Live');
    expect(screen.getByRole('list', { name: 'People in this room' })).toHaveTextContent(
      'Ada (you)',
    );
    expect(window.localStorage.getItem('acrosticle:name')).toBe('Ada');
  });

  it('puts the cursor in the name box, ready to type', async () => {
    render(<RoomPage roomId={ROOM_ID} />);
    expect(await screen.findByLabelText(/Your name/)).toHaveFocus();
  });

  it('suggests the account name when signed in', async () => {
    backend.signIn({ name: 'Ada Lovelace' });
    render(
      <SessionProvider>
        <RoomPage roomId={ROOM_ID} />
      </SessionProvider>,
    );
    expect(await screen.findByDisplayValue('Ada Lovelace')).toHaveFocus();
  });

  it('joins straight away with a remembered name', async () => {
    window.localStorage.setItem('acrosticle:name', 'Bo');
    render(<RoomPage roomId={ROOM_ID} />);
    expect(await screen.findByRole('grid', { name: 'Quotation grid' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'People in this room' })).toHaveTextContent('Bo (you)');
  });

  it('shows letters already in the room', async () => {
    room.cells.set(3, 'R' as Letter);
    await joinAs('Ada');
    expect(square(3)).toHaveAccessibleName('Square 3, clue A, R');
  });

  it('sends typed letters to the room', async () => {
    const user = await joinAs('Ada');
    await user.click(square(1));
    await user.keyboard('xy');
    expect(square(1)).toHaveAccessibleName('Square 1, clue A, X');
    expect([...room.cells]).toEqual([
      [1, 'X'],
      [2, 'Y'],
    ]);
  });

  it("shows other solvers' letters and cursors", async () => {
    await joinAs('Ada');
    act(() => {
      room.remoteEdit(5, 'Z' as Letter);
      room.remoteVisitor({ id: 'cy', name: 'Cy', color: '#00aa00' }, 4);
    });
    expect(square(5)).toHaveAccessibleName('Square 5, clue A, Z');
    expect(square(4).style.getPropertyValue('--peer-color')).toBe('#00aa00');
    expect(square(4)).toHaveAccessibleName('Square 4, clue B, empty, Cy is here');
    expect(screen.getByRole('list', { name: 'People in this room' })).toHaveTextContent('Cy');
  });

  it('keeps working through a dropped connection, sending offline edits on reconnect', async () => {
    const user = await joinAs('Ada');
    act(() => room.dropAll());
    expect(screen.getByRole('status')).toHaveTextContent('Reconnecting…');

    await user.click(square(5));
    await user.keyboard('k');
    expect(square(5)).toHaveAccessibleName('Square 5, clue A, K');
    expect(room.cells.has(5)).toBe(false);

    expect(await screen.findByText('Live', {}, { timeout: 2000 })).toBeInTheDocument();
    expect(room.cells.get(5)).toBe('K');
  });
});
