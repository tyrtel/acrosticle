import type { MyRoomsResponse } from '@acrosticle/protocol';
import { roomPath } from '@acrosticle/protocol';
import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { Link } from '../../components/Link';
import { relativeTime } from '../../lib/relativeTime';
import { deleteRoom, fetchMyRooms } from './accountApi';
import { SignInButton } from './AccountBar';
import styles from './MyPuzzlesPanel.module.css';
import { useSession } from './sessionContext';

type Room = MyRoomsResponse['rooms'][number];

type Rooms =
  | { readonly kind: 'loading' }
  | { readonly kind: 'loaded'; readonly rooms: readonly Room[] }
  | { readonly kind: 'failed'; readonly error: string };

export interface MyPuzzlesPanelProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onNewPuzzle: () => void;
}

/**
 * A panel that slides in from the right with every puzzle you created or
 * joined, most recently active first. Built on <dialog>, so focus stays inside
 * while it's open and Escape closes it.
 */
export function MyPuzzlesPanel({ open, onClose, onNewPuzzle }: MyPuzzlesPanelProps) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);

  // Clicks on the backdrop land on the <dialog> itself, outside its content.
  const onDialogClick = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target === event.currentTarget) onClose();
  };

  return (
    <dialog
      ref={dialog}
      className={styles.panel}
      aria-labelledby="my-puzzles-title"
      onClose={onClose}
      onClick={onDialogClick}
    >
      <div className={styles.content}>
        <header className={styles.header}>
          <h2 id="my-puzzles-title">My puzzles</h2>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <button type="button" className={styles.newPuzzle} onClick={onNewPuzzle}>
          + New puzzle
        </button>
        {open && <PanelBody onOpenRoom={onClose} />}
      </div>
    </dialog>
  );
}

function PanelBody({ onOpenRoom }: { onOpenRoom: () => void }) {
  const { loaded, me } = useSession();
  if (!loaded) return <p>Loading…</p>;
  if (!me.user) {
    return (
      <div>
        <p>Sign in to see the puzzles you&apos;ve created and joined.</p>
        <SignInButton />
      </div>
    );
  }
  return <RoomList onOpenRoom={onOpenRoom} />;
}

function RoomList({ onOpenRoom }: { onOpenRoom: () => void }) {
  const [rooms, setRooms] = useState<Rooms>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    void fetchMyRooms().then((result) => {
      if (cancelled) return;
      setRooms(
        result.ok
          ? { kind: 'loaded', rooms: result.value.rooms }
          : { kind: 'failed', error: result.error },
      );
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (rooms.kind === 'loading') return <p>Loading your puzzles…</p>;
  if (rooms.kind === 'failed') return <p role="alert">{rooms.error}</p>;
  if (rooms.rooms.length === 0) {
    return <p>No puzzles yet. Start one, or open a link someone shared with you.</p>;
  }

  const removeRoom = (roomId: string) =>
    setRooms({ kind: 'loaded', rooms: rooms.rooms.filter((r) => r.roomId !== roomId) });

  return (
    <ul className={styles.rooms} aria-label="Puzzles, most recently active first">
      {rooms.rooms.map((room) => (
        <RoomItem
          key={room.roomId}
          room={room}
          onOpen={onOpenRoom}
          onDeleted={() => removeRoom(room.roomId)}
        />
      ))}
    </ul>
  );
}

interface RoomItemProps {
  readonly room: Room;
  readonly onOpen: () => void;
  readonly onDeleted: () => void;
}

function RoomItem({ room, onOpen, onDeleted }: RoomItemProps) {
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const title = room.title ?? 'Untitled puzzle';
  const link = `${window.location.origin}${roomPath(room.roomId)}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2_000);
    } catch {
      setError(`Couldn't copy. The link is ${link}`);
    }
  };

  const remove = async () => {
    setDeleting(true);
    const result = await deleteRoom(room.roomId);
    setDeleting(false);
    if (result.ok) onDeleted();
    else setError(result.error);
  };

  return (
    <li className={room.createdByMe ? `${styles.room} ${styles.mine}` : styles.room}>
      <div className={styles.titleRow}>
        <Link href={roomPath(room.roomId)} className={styles.title} onClick={onOpen}>
          {title}
        </Link>
        {room.createdByMe && (
          <span className={styles.mineBadge} title="You created this puzzle">
            <span aria-hidden="true">★</span>
            <span className="visually-hidden">Created by you</span>
          </span>
        )}
      </div>
      <p className={styles.meta}>
        <time dateTime={new Date(room.updatedAt).toISOString()}>
          Active {relativeTime(room.updatedAt)}
        </time>
      </p>
      {confirming ? (
        <div className={styles.confirm} role="group" aria-label={`Delete ${title}?`}>
          <p>Delete &ldquo;{title}&rdquo; for everyone? All progress will be lost.</p>
          <button
            type="button"
            className={styles.danger}
            disabled={deleting}
            onClick={() => void remove()}
          >
            {deleting ? 'Deleting…' : 'Delete for everyone'}
          </button>
          <button type="button" disabled={deleting} onClick={() => setConfirming(false)}>
            Cancel
          </button>
        </div>
      ) : (
        <div className={styles.actions}>
          <button type="button" onClick={() => void copy()} aria-label={`Copy link to ${title}`}>
            {copied ? 'Copied!' : 'Copy link'}
          </button>
          {room.createdByMe && (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              aria-label={`Delete ${title}`}
            >
              Delete
            </button>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </li>
  );
}
