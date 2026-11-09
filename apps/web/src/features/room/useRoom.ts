import type { CellEdit, CellNumber, SolveState } from '@acrosticle/core';
import type { ServerMessage } from '@acrosticle/protocol';
import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import type { PeerMap } from '../../components/PeerTag';
import { RoomConnection, roomSocketUrl, type SocketLike } from './RoomConnection';
import {
  initialRoomState,
  peerCursors,
  roomReducer,
  visibleSolve,
  type PendingEdit,
  type RoomState,
} from './roomState';

export interface UseRoomResult {
  readonly state: RoomState;
  /** Letters to show: confirmed by the room, plus our pending edits. */
  readonly solve: SolveState;
  readonly peers: PeerMap;
  readonly setCell: (edit: CellEdit) => void;
  readonly setPresence: (cell: CellNumber | null) => void;
}

/** Joins a room and keeps its state live. Edits made while offline are sent on reconnect. */
export function useRoom(
  roomId: string,
  name: string,
  createSocket?: (url: string) => SocketLike,
): UseRoomResult {
  const [state, dispatch] = useReducer(roomReducer, initialRoomState);
  const connection = useRef<RoomConnection | null>(null);
  const nextSeq = useRef(1);
  const pending = useRef<ReadonlyMap<CellNumber, PendingEdit>>(state.pending);
  const lastPresence = useRef<CellNumber | null>(null);

  useEffect(() => {
    pending.current = state.pending;
  }, [state.pending]);

  useEffect(() => {
    const conn = new RoomConnection({
      url: roomSocketUrl(roomId, window.location),
      name,
      createSocket,
      onStatus: (status) => dispatch({ type: 'connection', status }),
      onMessage: (message: ServerMessage) => {
        dispatch({ type: 'server', message });
        if (message.type === 'snapshot') {
          // After (re)joining, re-send anything the room hasn't confirmed yet,
          // and our cursor position.
          for (const [cell, edit] of pending.current) {
            conn.send({ type: 'cell/set', cell, ...edit });
          }
          if (lastPresence.current !== null) {
            conn.send({ type: 'presence/update', cell: lastPresence.current });
          }
        }
      },
    });
    connection.current = conn;
    conn.connect();
    return () => {
      conn.close();
      connection.current = null;
    };
  }, [roomId, name, createSocket]);

  const setCell = useCallback((edit: CellEdit) => {
    const clientSeq = nextSeq.current++;
    dispatch({ type: 'local-edit', edit, clientSeq });
    connection.current?.send({ type: 'cell/set', ...edit, clientSeq });
  }, []);

  const setPresence = useCallback((cell: CellNumber | null) => {
    lastPresence.current = cell;
    connection.current?.send({ type: 'presence/update', cell });
  }, []);

  const solve = useMemo(() => visibleSolve(state), [state]);
  const peers = useMemo(() => peerCursors(state), [state]);
  return { state, solve, peers, setCell, setPresence };
}
