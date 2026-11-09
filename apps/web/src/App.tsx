import type { Puzzle } from '@acrosticle/core';
import { roomPath } from '@acrosticle/protocol';
import { useState } from 'react';
import { Link } from './components/Link';
import {
  AccountBar,
  MyPuzzles,
  SessionProvider,
  SignInButton,
  SignInNotice,
  useSession,
} from './features/account';
import { ImportPuzzle, ReviewPuzzle } from './features/editor';
import { createRoom, createSampleRoom, RoomPage } from './features/room';
import type { ApiResult } from './lib/api';
import { navigate, useRoute } from './lib/router';

export function App() {
  return (
    <SessionProvider>
      <Shell />
    </SessionProvider>
  );
}

function Shell() {
  const route = useRoute();
  return (
    <main className="app">
      <header className="app-header">
        <h1>
          <Link href="/" className="home-link">
            Acrosticle
          </Link>
        </h1>
        <AccountBar />
      </header>
      <SignInNotice />
      {route.kind === 'home' && <Home />}
      {route.kind === 'my' && <MyPuzzles />}
      {route.kind === 'room' && <RoomPage key={route.roomId} roomId={route.roomId} />}
      {route.kind === 'not-found' && <p role="alert">There&apos;s nothing at this address.</p>}
    </main>
  );
}

type HomeScreen =
  | { readonly kind: 'start' }
  | { readonly kind: 'import' }
  | { readonly kind: 'review'; readonly puzzle: Puzzle };

/** Start page: open the sample, or import and review a puzzle, then create a room for it. */
function Home() {
  const { me } = useSession();
  const [screen, setScreen] = useState<HomeScreen>({ kind: 'start' });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startRoom = async (create: () => Promise<ApiResult<string>>) => {
    setCreating(true);
    setError(null);
    const result = await create();
    setCreating(false);
    if (result.ok) navigate(roomPath(result.value));
    else setError(result.error);
  };

  return (
    <>
      {screen.kind !== 'start' && (
        <p>
          <button type="button" onClick={() => setScreen({ kind: 'start' })}>
            ← Back
          </button>
        </p>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {creating && <p role="status">Creating your room…</p>}
      {screen.kind === 'start' && (
        <>
          <p>Solve acrostic puzzles together, in real time.</p>
          <p className="home-actions">
            <button
              type="button"
              disabled={creating}
              onClick={() => void startRoom(() => createSampleRoom('diplo-crostic-37'))}
            >
              Try the sample puzzle
            </button>{' '}
            <button
              type="button"
              disabled={!me.canCreate}
              aria-describedby={me.canCreate ? undefined : 'import-note'}
              onClick={() => setScreen({ kind: 'import' })}
            >
              Import a puzzle file
            </button>
          </p>
          {!me.canCreate && <ImportNote />}
        </>
      )}
      {screen.kind === 'import' && (
        <ImportPuzzle onImport={(puzzle) => setScreen({ kind: 'review', puzzle })} />
      )}
      {screen.kind === 'review' && (
        <ReviewPuzzle
          initialPuzzle={screen.puzzle}
          onStart={(puzzle) => void startRoom(() => createRoom(puzzle))}
        />
      )}
    </>
  );
}

/** Why importing isn't available yet. */
function ImportNote() {
  const { loaded, me } = useSession();
  if (!loaded) return null;
  if (me.user) {
    return (
      <p id="import-note" className="note">
        Your account ({me.user.email}) isn&apos;t enabled for creating puzzles yet. Ask the site
        owner to add it.
      </p>
    );
  }
  return (
    <div id="import-note" className="note">
      <p>Sign in to import your own puzzles. The sample needs no account.</p>
      <SignInButton />
    </div>
  );
}
