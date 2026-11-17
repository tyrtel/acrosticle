import type { Puzzle } from '@gridicles/acrostic';
import { roomPath } from '@gridicles/protocol';
import { useEffect, useState } from 'react';
import { Link } from './components/Link';
import {
  AccountBar,
  MyPuzzlesPanel,
  SessionProvider,
  SignInButton,
  SignInNotice,
  useSession,
} from './features/account';
import { ImportPuzzle, ReviewPuzzle, UploadImage } from './features/editor';
import { blankCrossword, type Crossword } from '@gridicles/crossword';
import { CrosswordEditor, ImportCrossword } from './features/crossword';
import { createCrosswordRoom, createRoom, createSampleRoom, RoomPage } from './features/room';
import type { ApiResult } from './lib/api';
import { SITE } from './lib/site';
import { ThemeToggle } from './components/ThemeToggle';
import { navigate, setSearchParam, useRoute, useSearchParam } from './lib/router';

export function App() {
  return (
    <SessionProvider>
      <Shell />
    </SessionProvider>
  );
}

function Shell() {
  const route = useRoute();
  const { me } = useSession();
  const panelOpen = useSearchParam('panel') === 'my';
  // Bumped by "New puzzle" so the start screen resets even if it's already showing.
  const [homeKey, setHomeKey] = useState(0);

  // Old /my links open the panel instead.
  useEffect(() => {
    if (route.kind === 'my') {
      window.history.replaceState(null, '', '/?panel=my');
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  }, [route.kind]);

  const newPuzzle = () => {
    setHomeKey((key) => key + 1);
    navigate('/');
  };

  return (
    <main className="app">
      <header className="app-header">
        <h1>
          <Link href="/" className="home-link">
            {SITE.name}
          </Link>
        </h1>
        <nav className="app-nav" aria-label="Main">
          <button type="button" onClick={newPuzzle}>
            New puzzle
          </button>
          {me.user && (
            <button type="button" onClick={() => setSearchParam('panel', 'my')}>
              My puzzles
            </button>
          )}
          <ThemeToggle />
          <AccountBar />
        </nav>
      </header>
      <SignInNotice />
      {(route.kind === 'home' || route.kind === 'my') && <Home key={homeKey} />}
      {route.kind === 'room' && <RoomPage key={route.roomId} roomId={route.roomId} />}
      {route.kind === 'not-found' && <p role="alert">There&apos;s nothing at this address.</p>}
      <MyPuzzlesPanel
        open={panelOpen}
        onClose={() => setSearchParam('panel', null)}
        onNewPuzzle={newPuzzle}
      />
    </main>
  );
}

type HomeScreen =
  | { readonly kind: 'start' }
  | { readonly kind: 'import' }
  | { readonly kind: 'upload' }
  | { readonly kind: 'review'; readonly puzzle: Puzzle; readonly notes?: readonly string[] }
  | { readonly kind: 'edit-crossword'; readonly crossword: Crossword };

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
          <p>{SITE.tagline}</p>
          <p className="home-actions">
            <button
              type="button"
              disabled={creating || !me.canStartSample}
              aria-describedby={me.canStartSample ? undefined : 'import-note'}
              onClick={() => void startRoom(() => createSampleRoom(SITE.sample))}
            >
              {SITE.kind === 'crossword' ? 'Try the sample crossword' : 'Try the sample puzzle'}
            </button>{' '}
            {SITE.kind === 'acrostic' && (
              <>
                <button
                  type="button"
                  disabled={!me.canCreate}
                  aria-describedby={me.canCreate ? undefined : 'import-note'}
                  onClick={() => setScreen({ kind: 'upload' })}
                >
                  Upload a puzzle image
                </button>{' '}
              </>
            )}
            <button
              type="button"
              disabled={!me.canCreate}
              aria-describedby={me.canCreate ? undefined : 'import-note'}
              onClick={() => setScreen({ kind: 'import' })}
            >
              Import a puzzle file
            </button>
            {SITE.kind === 'crossword' && (
              <>
                {' '}
                <button
                  type="button"
                  disabled={!me.canCreate}
                  aria-describedby={me.canCreate ? undefined : 'import-note'}
                  onClick={() =>
                    setScreen({ kind: 'edit-crossword', crossword: blankCrossword(15, 15) })
                  }
                >
                  Build a crossword
                </button>
              </>
            )}
          </p>
          {!me.canCreate && <ImportNote />}
        </>
      )}
      {screen.kind === 'import' && SITE.kind === 'crossword' && (
        <ImportCrossword onLoad={(crossword) => setScreen({ kind: 'edit-crossword', crossword })} />
      )}
      {screen.kind === 'edit-crossword' && (
        <CrosswordEditor
          initial={screen.crossword}
          starting={creating}
          onStart={(crossword) => void startRoom(() => createCrosswordRoom(crossword))}
        />
      )}
      {screen.kind === 'import' && SITE.kind === 'acrostic' && (
        <ImportPuzzle onImport={(puzzle) => setScreen({ kind: 'review', puzzle })} />
      )}
      {screen.kind === 'upload' && (
        <UploadImage
          onParsed={({ puzzle, notes }) => setScreen({ kind: 'review', puzzle, notes })}
        />
      )}
      {screen.kind === 'review' && (
        <ReviewPuzzle
          initialPuzzle={screen.puzzle}
          notes={screen.notes}
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
        Your account ({me.user.email}) isn&apos;t enabled for starting puzzles yet. Ask the site
        owner to add it.
      </p>
    );
  }
  return (
    <div id="import-note" className="note">
      <p>
        {me.canStartSample
          ? 'Sign in to add your own puzzles (from an image or a file).'
          : 'Sign in with an invited account to start puzzles, including the sample.'}
      </p>
      <SignInButton />
    </div>
  );
}
