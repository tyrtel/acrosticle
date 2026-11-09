import {
  applyEdit,
  emptySolveState,
  puzzleFromCompact,
  setCell,
  type CellEdit,
  type CellNumber,
  type Letter,
  type Puzzle,
  type SolveState,
} from '@acrosticle/core';
import type { Member, ServerMessage } from '@acrosticle/protocol';
import type { Peer, PeerMap } from '../../components/PeerTag';
import type { ConnectionStatus } from './RoomConnection';

/** An edit applied locally but not yet confirmed by the room. */
export interface PendingEdit {
  readonly value: Letter | null;
  readonly clientSeq: number;
}

export interface RoomState {
  readonly connection: ConnectionStatus;
  readonly puzzle: Puzzle | null;
  /** Letters as last confirmed by the room. */
  readonly confirmed: SolveState;
  /** Our own edits still waiting for confirmation, shown on top of `confirmed`. */
  readonly pending: ReadonlyMap<CellNumber, PendingEdit>;
  readonly version: number;
  readonly me: string | null;
  readonly members: readonly Member[];
  /** Where other members' cursors are. */
  readonly presence: ReadonlyMap<string, CellNumber>;
  readonly error: string | null;
}

export type RoomEvent =
  | { readonly type: 'server'; readonly message: ServerMessage }
  | { readonly type: 'connection'; readonly status: ConnectionStatus }
  | { readonly type: 'local-edit'; readonly edit: CellEdit; readonly clientSeq: number };

export const initialRoomState: RoomState = {
  connection: 'connecting',
  puzzle: null,
  confirmed: emptySolveState,
  pending: new Map(),
  version: 0,
  me: null,
  members: [],
  presence: new Map(),
  error: null,
};

/**
 * Client-side room state. The room is the source of truth (ADR 0002); local
 * edits show immediately as "pending" and are dropped once the room echoes
 * them back. A snapshot replaces confirmed state but keeps pending edits,
 * which the connection re-sends after reconnecting.
 */
export function roomReducer(state: RoomState, event: RoomEvent): RoomState {
  switch (event.type) {
    case 'connection':
      return { ...state, connection: event.status };
    case 'local-edit': {
      const pending = new Map(state.pending);
      pending.set(event.edit.cell, { value: event.edit.value, clientSeq: event.clientSeq });
      return { ...state, pending };
    }
    case 'server':
      return applyServerMessage(state, event.message);
  }
}

function applyServerMessage(state: RoomState, message: ServerMessage): RoomState {
  switch (message.type) {
    case 'snapshot': {
      const converted = state.puzzle ? null : puzzleFromCompact(message.puzzle);
      if (converted && !converted.ok) {
        return { ...state, error: `The room's puzzle couldn't be read: ${converted.error}` };
      }
      let confirmed = emptySolveState;
      for (const [cell, letter] of message.cells) confirmed = setCell(confirmed, cell, letter);
      return {
        ...state,
        // Keep the same puzzle object across reconnects so the solver doesn't reset.
        puzzle: state.puzzle ?? (converted?.ok ? converted.puzzle : null),
        confirmed,
        version: message.version,
        me: message.you,
        members: message.members,
        presence: new Map(message.presence.filter(([id]) => id !== message.you)),
        error: null,
      };
    }
    case 'cell/updated': {
      const confirmed = setCell(state.confirmed, message.cell, message.value);
      const mine = state.pending.get(message.cell);
      if (message.by !== state.me || mine?.clientSeq !== message.clientSeq) {
        return { ...state, confirmed, version: message.version };
      }
      const pending = new Map(state.pending);
      pending.delete(message.cell);
      return { ...state, confirmed, pending, version: message.version };
    }
    case 'presence': {
      if (message.member === state.me) return state;
      const presence = new Map(state.presence);
      if (message.cell === null) presence.delete(message.member);
      else presence.set(message.member, message.cell);
      return { ...state, presence };
    }
    case 'member/joined':
      return {
        ...state,
        members: [...state.members.filter((m) => m.id !== message.member.id), message.member],
      };
    case 'member/left': {
      const presence = new Map(state.presence);
      presence.delete(message.member);
      return { ...state, members: state.members.filter((m) => m.id !== message.member), presence };
    }
    case 'error':
      return { ...state, error: message.message };
    case 'pong':
      return state;
  }
}

/** The letters to display: confirmed state with our pending edits on top. */
export function visibleSolve(state: RoomState): SolveState {
  let solve = state.confirmed;
  for (const [cell, { value }] of state.pending) solve = applyEdit(solve, { cell, value });
  return solve;
}

/** Other members' cursor positions: cell -> who is there, in member order. */
export function peerCursors(state: RoomState): PeerMap {
  const cursors = new Map<CellNumber, Peer[]>();
  for (const member of state.members) {
    const cell = state.presence.get(member.id);
    if (cell === undefined) continue;
    const here = cursors.get(cell) ?? [];
    here.push(member);
    cursors.set(cell, here);
  }
  return cursors;
}
