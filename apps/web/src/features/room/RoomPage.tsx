import { MAX_NAME_LENGTH, type RoomInfoResponse } from '@acrosticle/protocol';
import { useEffect, useId, useState, type FormEvent } from 'react';
import { useSession } from '../account';
import { Solver } from '../solver';
import styles from './Room.module.css';
import { getRoomInfo } from './roomApi';
import type { ConnectionStatus, SocketLike } from './RoomConnection';
import { loadName, saveName } from './storedName';
import { useRoom } from './useRoom';

export interface RoomPageProps {
  readonly roomId: string;
  /** For tests: replaces the browser WebSocket. */
  readonly createSocket?: (url: string) => SocketLike;
}

type Lookup =
  | { readonly kind: 'loading' }
  | { readonly kind: 'found'; readonly info: RoomInfoResponse }
  | { readonly kind: 'not-found' }
  | { readonly kind: 'failed'; readonly error: string };

/** A shared solving room: check it exists, ask for a display name, then join. */
export function RoomPage({ roomId, createSocket }: RoomPageProps) {
  const [lookup, setLookup] = useState<Lookup>({ kind: 'loading' });
  // Returning visitors join straight away with the name they used last time.
  const [name, setName] = useState<string | null>(() => loadName() || null);

  useEffect(() => {
    let cancelled = false;
    void getRoomInfo(roomId).then((result) => {
      if (cancelled) return;
      if (result.ok) setLookup({ kind: 'found', info: result.value });
      else if (result.status === 404) setLookup({ kind: 'not-found' });
      else setLookup({ kind: 'failed', error: result.error });
    });
    return () => {
      cancelled = true;
    };
  }, [roomId]);

  switch (lookup.kind) {
    case 'loading':
      return <p>Opening the room…</p>;
    case 'not-found':
      return (
        <div role="alert">
          <h2>Room not found</h2>
          <p>This link doesn&apos;t match any puzzle room. Check that you copied the whole link.</p>
        </div>
      );
    case 'failed':
      return <p role="alert">{lookup.error}</p>;
    case 'found':
      return name === null ? (
        <JoinForm
          title={lookup.info.title}
          onJoin={(chosen) => {
            saveName(chosen);
            setName(chosen);
          }}
        />
      ) : (
        <Room roomId={roomId} name={name} createSocket={createSocket} />
      );
  }
}

function JoinForm({ title, onJoin }: { title: string | null; onJoin: (name: string) => void }) {
  const { me } = useSession();
  // Suggest the account name; it can still be changed for this room.
  const [value, setValue] = useState(() => loadName() || me.user?.name || '');
  const id = useId();
  const trimmed = value.trim();

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (trimmed) onJoin(trimmed);
  };

  return (
    <form className={styles.join} onSubmit={onSubmit}>
      <h2>{title ?? 'Untitled puzzle'}</h2>
      <label htmlFor={id}>Your name, so others know who&apos;s solving</label>
      <input
        id={id}
        value={value}
        maxLength={MAX_NAME_LENGTH}
        autoComplete="nickname"
        // The name is the only thing on this screen: let people type right away.
        autoFocus
        onChange={(e) => setValue(e.target.value)}
      />
      <button type="submit" disabled={!trimmed}>
        Join
      </button>
    </form>
  );
}

interface RoomProps {
  readonly roomId: string;
  readonly name: string;
  readonly createSocket: ((url: string) => SocketLike) | undefined;
}

function Room({ roomId, name, createSocket }: RoomProps) {
  const { state, solve, peers, setCell, setPresence } = useRoom(roomId, name, createSocket);

  if (!state.puzzle) {
    return <p>{state.error ?? 'Joining the room…'}</p>;
  }

  return (
    <div className={styles.room}>
      <div className={styles.bar}>
        <ConnectionBadge status={state.connection} />
        <ShareLink />
        <ul className={styles.members} aria-label="People in this room">
          {state.members.map((member) => (
            <li key={member.id} className={styles.member}>
              <span
                className={styles.swatch}
                style={{ background: member.color }}
                aria-hidden="true"
              />
              {member.name}
              {member.id === state.me && ' (you)'}
            </li>
          ))}
        </ul>
      </div>
      {state.error && (
        <p role="alert" className={styles.error}>
          {state.error}
        </p>
      )}
      <Solver
        puzzle={state.puzzle}
        solve={solve}
        onEdit={setCell}
        peers={peers}
        onSelectionChange={setPresence}
      />
    </div>
  );
}

function ConnectionBadge({ status }: { status: ConnectionStatus }) {
  const text = {
    connecting: 'Connecting…',
    connected: 'Live',
    reconnecting: 'Reconnecting…',
    closed: 'Disconnected',
  }[status];
  return (
    <span role="status" className={`${styles.badge} ${styles[status]}`}>
      {text}
    </span>
  );
}

function ShareLink() {
  const [copied, setCopied] = useState(false);
  const url = window.location.href;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <span className={styles.share}>
      <label>
        Share link <input readOnly value={url} size={36} onFocus={(e) => e.target.select()} />
      </label>
      <button type="button" onClick={() => void copy()}>
        {copied ? 'Copied!' : 'Copy link'}
      </button>
    </span>
  );
}
