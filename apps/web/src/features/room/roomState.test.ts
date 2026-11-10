import type { Entry } from '@acrosticle/core';
import type { ServerMessage } from '@acrosticle/protocol';
import { describe, expect, it } from 'vitest';
import {
  initialRoomState,
  peerCursors,
  roomReducer,
  visibleSolve,
  type RoomState,
} from './roomState';

const L = (s: string) => s as Entry;
const puzzleFile = {
  grid: { columns: 2, rows: ['1A 2A'] },
  clues: [{ label: 'A', text: 'x', cells: [1, 2] }],
};
const ada = { id: 'ada', name: 'Ada', color: '#a00' };
const bo = { id: 'bo', name: 'Bo', color: '#00b' };

const snapshot = (
  overrides: Partial<Extract<ServerMessage, { type: 'snapshot' }>> = {},
): ServerMessage => ({
  type: 'snapshot',
  puzzle: puzzleFile,
  cells: [[1, L('Q')]],
  version: 5,
  you: 'ada',
  members: [ada, bo],
  presence: [
    ['bo', 2],
    ['ada', 1],
  ],
  ...overrides,
});

const server = (state: RoomState, message: ServerMessage) =>
  roomReducer(state, { type: 'server', message });
const joined = () => server(initialRoomState, snapshot());

describe('roomReducer', () => {
  it("loads a snapshot: puzzle, letters, members, and others' cursors", () => {
    const state = joined();
    expect(state.puzzle?.clues).toHaveLength(1);
    expect(state.confirmed).toEqual({ 1: 'Q' });
    expect(state.version).toBe(5);
    expect(state.me).toBe('ada');
    expect(state.members).toEqual([ada, bo]);
    expect([...state.presence]).toEqual([['bo', 2]]);
  });

  it('keeps the same puzzle object across reconnect snapshots', () => {
    const first = joined();
    const again = server(first, snapshot({ cells: [], version: 9 }));
    expect(again.puzzle).toBe(first.puzzle);
    expect(again.confirmed).toEqual({});
  });

  it('reports an unreadable puzzle', () => {
    const bad = snapshot({ puzzle: { grid: { columns: 2, rows: ['1A ??'] }, clues: [] } });
    expect(server(initialRoomState, bad).error).toMatch(/couldn't be read/);
  });

  it('shows local edits immediately, then clears them when confirmed', () => {
    let state = roomReducer(joined(), {
      type: 'local-edit',
      edit: { cell: 2, value: L('Z') },
      clientSeq: 1,
    });
    expect(visibleSolve(state)).toEqual({ 1: 'Q', 2: 'Z' });

    state = server(state, {
      type: 'cell/updated',
      cell: 2,
      value: L('Z'),
      version: 6,
      by: 'ada',
      clientSeq: 1,
    });
    expect(state.pending.size).toBe(0);
    expect(state.confirmed).toEqual({ 1: 'Q', 2: 'Z' });
    expect(state.version).toBe(6);
  });

  it('keeps a newer pending edit when an older one is confirmed', () => {
    let state = roomReducer(joined(), {
      type: 'local-edit',
      edit: { cell: 2, value: L('A') },
      clientSeq: 1,
    });
    state = roomReducer(state, {
      type: 'local-edit',
      edit: { cell: 2, value: L('B') },
      clientSeq: 2,
    });
    state = server(state, {
      type: 'cell/updated',
      cell: 2,
      value: L('A'),
      version: 6,
      by: 'ada',
      clientSeq: 1,
    });
    expect(visibleSolve(state)[2]).toBe('B');
  });

  it("applies other members' edits, keeping our pending edit on top", () => {
    let state = roomReducer(joined(), {
      type: 'local-edit',
      edit: { cell: 2, value: L('M') },
      clientSeq: 3,
    });
    state = server(state, {
      type: 'cell/updated',
      cell: 2,
      value: L('X'),
      version: 6,
      by: 'bo',
      clientSeq: 3,
    });
    expect(state.confirmed[2]).toBe('X');
    expect(visibleSolve(state)[2]).toBe('M');

    state = server(state, {
      type: 'cell/updated',
      cell: 1,
      value: null,
      version: 7,
      by: 'bo',
      clientSeq: 9,
    });
    expect(visibleSolve(state)).toEqual({ 2: 'M' });
  });

  it('keeps pending edits across a reconnect snapshot', () => {
    let state = roomReducer(joined(), {
      type: 'local-edit',
      edit: { cell: 2, value: L('Z') },
      clientSeq: 1,
    });
    state = server(state, snapshot({ cells: [] }));
    expect(visibleSolve(state)).toEqual({ 2: 'Z' });
  });

  it('tracks presence, ignoring our own', () => {
    let state = server(joined(), { type: 'presence', member: 'bo', cell: 1 });
    expect(state.presence.get('bo')).toBe(1);
    state = server(state, { type: 'presence', member: 'bo', cell: null });
    expect(state.presence.has('bo')).toBe(false);
    expect(server(state, { type: 'presence', member: 'ada', cell: 2 })).toBe(state);
  });

  it('tracks members joining and leaving', () => {
    const cy = { id: 'cy', name: 'Cy', color: '#0c0' };
    let state = server(joined(), { type: 'member/joined', member: cy });
    state = server(state, { type: 'member/joined', member: cy });
    expect(state.members.map((m) => m.id)).toEqual(['ada', 'bo', 'cy']);

    state = server(state, { type: 'member/left', member: 'bo' });
    expect(state.members.map((m) => m.id)).toEqual(['ada', 'cy']);
    expect(state.presence.has('bo')).toBe(false);
  });

  it('records errors and connection status; ignores pong', () => {
    const state = joined();
    expect(server(state, { type: 'error', message: 'nope' }).error).toBe('nope');
    expect(roomReducer(state, { type: 'connection', status: 'reconnecting' }).connection).toBe(
      'reconnecting',
    );
    expect(server(state, { type: 'pong' })).toBe(state);
  });
});

describe('peerCursors', () => {
  it('maps cells to the members there, in member order', () => {
    const cy = { id: 'cy', name: 'Cy', color: '#0c0' };
    const state = server(joined(), { type: 'member/joined', member: cy });
    const withCy = server(state, { type: 'presence', member: 'cy', cell: 2 });
    expect([...peerCursors(withCy)]).toEqual([[2, [bo, cy]]]);
  });

  it('skips cursors of unknown members', () => {
    const state = server(joined(), { type: 'presence', member: 'ghost', cell: 1 });
    expect(peerCursors(state).has(1)).toBe(false);
  });
});
