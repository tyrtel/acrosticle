import type { Puzzle } from '@acrosticle/core';
import { useState } from 'react';
import { ImportPuzzle, ReviewPuzzle } from './features/editor';
import { Solver } from './features/solver';
import { loadSamplePuzzle } from './lib/samplePuzzles';

type Screen =
  | { readonly kind: 'home' }
  | { readonly kind: 'import' }
  | { readonly kind: 'review'; readonly puzzle: Puzzle }
  | { readonly kind: 'solve'; readonly puzzle: Puzzle };

export function App() {
  const [screen, setScreen] = useState<Screen>({ kind: 'home' });

  return (
    <main className="app">
      <h1>Acrosticle</h1>
      {screen.kind !== 'home' && (
        <p>
          <button type="button" onClick={() => setScreen({ kind: 'home' })}>
            ← Home
          </button>
        </p>
      )}
      {renderScreen(screen, setScreen)}
    </main>
  );
}

function renderScreen(screen: Screen, setScreen: (screen: Screen) => void) {
  switch (screen.kind) {
    case 'home':
      return (
        <>
          <p>Solve acrostic puzzles together, in real time.</p>
          <p className="home-actions">
            <button
              type="button"
              onClick={() => setScreen({ kind: 'solve', puzzle: loadSamplePuzzle() })}
            >
              Try the sample puzzle
            </button>{' '}
            <button type="button" onClick={() => setScreen({ kind: 'import' })}>
              Import a puzzle file
            </button>
          </p>
        </>
      );
    case 'import':
      return <ImportPuzzle onImport={(puzzle) => setScreen({ kind: 'review', puzzle })} />;
    case 'review':
      return (
        <ReviewPuzzle
          initialPuzzle={screen.puzzle}
          onStart={(puzzle) => setScreen({ kind: 'solve', puzzle })}
        />
      );
    case 'solve':
      return <Solver puzzle={screen.puzzle} />;
  }
}
