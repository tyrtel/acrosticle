import type { Puzzle } from '@acrosticle/core';
import { roomPath } from '@acrosticle/protocol';
import { useState } from 'react';
import { ImportPuzzle, ReviewPuzzle } from './features/editor';
import { createRoom, RoomPage } from './features/room';
import { navigate, useRoute } from './lib/router';
import { loadSamplePuzzle } from './lib/samplePuzzles';

export function App() {
  const route = useRoute();

  return (
    <main className="app">
      <h1>
        <a href="/" className="home-link" onClick={(e) => (e.preventDefault(), navigate('/'))}>
          Acrosticle
        </a>
      </h1>
      {route.kind === 'home' && <Home />}
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
  const [screen, setScreen] = useState<HomeScreen>({ kind: 'start' });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startRoom = async (puzzle: Puzzle) => {
    setCreating(true);
    setError(null);
    const result = await createRoom(puzzle);
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
              onClick={() => void startRoom(loadSamplePuzzle())}
            >
              Try the sample puzzle
            </button>{' '}
            <button type="button" onClick={() => setScreen({ kind: 'import' })}>
              Import a puzzle file
            </button>
          </p>
        </>
      )}
      {screen.kind === 'import' && (
        <ImportPuzzle onImport={(puzzle) => setScreen({ kind: 'review', puzzle })} />
      )}
      {screen.kind === 'review' && (
        <ReviewPuzzle initialPuzzle={screen.puzzle} onStart={(puzzle) => void startRoom(puzzle)} />
      )}
    </>
  );
}
