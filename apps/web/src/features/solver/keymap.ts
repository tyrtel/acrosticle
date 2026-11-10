import { normalizeEntry, type View } from '@acrosticle/core';
import type { SolverAction } from './solverReducer';

/** The parts of a keyboard event the keymap needs (easy to build in tests). */
export interface KeyInput {
  readonly key: string;
  readonly shiftKey?: boolean;
  readonly ctrlKey?: boolean;
  readonly metaKey?: boolean;
  readonly altKey?: boolean;
}

/**
 * Maps a key press to a solver action, or null if the solver doesn't handle it
 * (so browser shortcuts like Ctrl+R keep working).
 *
 * | Key           | Grid view                  | Clue view                    |
 * | ------------- | -------------------------- | ---------------------------- |
 * | Any character | type, advance              | type, advance                |
 * | Arrows        | move in the grid           | ←/→ within clue, ↑/↓ clues   |
 * | Tab / ⇧Tab    | next / previous clue       | next / previous clue         |
 * | Backspace     | clear, or back and clear   | clear, or back and clear     |
 * | Delete        | clear in place             | clear in place               |
 * | Enter         | switch to clue view        | switch to grid view          |
 */
export function keyToAction(input: KeyInput, view: View): SolverAction | null {
  if (input.ctrlKey || input.metaKey || input.altKey) return null;

  switch (input.key) {
    case 'Backspace':
      return { type: 'erase' };
    case 'Delete':
      return { type: 'clear' };
    case 'Enter':
      return { type: 'toggleView' };
    case 'Tab':
      return { type: 'jumpClue', delta: input.shiftKey ? -1 : 1 };
    case 'ArrowLeft':
      return view === 'grid' ? { type: 'move', direction: 'left' } : { type: 'step', delta: -1 };
    case 'ArrowRight':
      return view === 'grid' ? { type: 'move', direction: 'right' } : { type: 'step', delta: 1 };
    case 'ArrowUp':
      return view === 'grid' ? { type: 'move', direction: 'up' } : { type: 'jumpClue', delta: -1 };
    case 'ArrowDown':
      return view === 'grid' ? { type: 'move', direction: 'down' } : { type: 'jumpClue', delta: 1 };
  }

  // Count characters, not UTF-16 units: some symbols and scripts take two units.
  if ([...input.key].length !== 1) return null;
  const entry = normalizeEntry(input.key);
  return entry ? { type: 'input', entry } : null;
}
