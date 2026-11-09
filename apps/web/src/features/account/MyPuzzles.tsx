import type { MyRoomsResponse } from '@acrosticle/protocol';
import { roomPath } from '@acrosticle/protocol';
import { useEffect, useState } from 'react';
import { Link } from '../../components/Link';
import styles from './Account.module.css';
import { fetchMyRooms } from './accountApi';
import { SignInButton } from './AccountBar';
import { useSession } from './sessionContext';

type Rooms =
  | { readonly kind: 'loading' }
  | { readonly kind: 'loaded'; readonly rooms: MyRoomsResponse['rooms'] }
  | { readonly kind: 'failed'; readonly error: string };

/** The rooms the signed-in user created. */
export function MyPuzzles() {
  const { loaded, me } = useSession();

  if (!loaded) return <p>Loading…</p>;
  if (!me.user) {
    return (
      <section>
        <h2>My puzzles</h2>
        <p>Sign in to see the puzzles you&apos;ve created.</p>
        <SignInButton />
      </section>
    );
  }
  return <RoomList />;
}

function RoomList() {
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

  return (
    <section>
      <h2>My puzzles</h2>
      {rooms.kind === 'loading' && <p>Loading your puzzles…</p>}
      {rooms.kind === 'failed' && <p role="alert">{rooms.error}</p>}
      {rooms.kind === 'loaded' && rooms.rooms.length === 0 && (
        <p>You haven&apos;t created any puzzle rooms yet.</p>
      )}
      {rooms.kind === 'loaded' && rooms.rooms.length > 0 && (
        <ul className={styles.rooms}>
          {rooms.rooms.map((room) => (
            <li key={room.roomId}>
              <Link href={roomPath(room.roomId)}>{room.title ?? 'Untitled puzzle'}</Link>{' '}
              <span className={styles.date}>
                created{' '}
                {new Date(room.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
