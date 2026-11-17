import type { View } from '@gridicles/acrostic';
import type { KeyInput } from '../../components/SolverShell';
import type { SolverAction } from './solverReducer';

/**
 * Maps a key press to an acrostic action, or null if the solver doesn't
 * handle it. Characters arrive as input events, and the shell handles the
 * keys every puzzle shares (undo, redo, highlight, multi-letter), so neither
 * comes here.
 *
 * | Key           | Grid view                  | Clue view                    |
 * | ------------- | -------------------------- | ---------------------------- |
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
      return input.shiftKey ? null : { type: 'toggleView' };
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
    default:
      return null;
  }
}
