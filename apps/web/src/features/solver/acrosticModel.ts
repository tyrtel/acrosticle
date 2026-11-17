import type { PuzzleIndex, Selection } from '@gridicles/acrostic';
import type { SolverModel } from '../../components/SolverShell';
import { clueBlankId, gridSquareId } from './elementIds';
import { keyToAction } from './keymap';
import { reduceSolver, type SolverAction } from './solverReducer';

/** How the acrostic cursor moves, for the shared solver shell. */
export function acrosticModel(index: PuzzleIndex): SolverModel<Selection, SolverAction> {
  const lastClue = index.clues.length - 1;
  return {
    type: (solve, selection, entry) =>
      reduceSolver(index, solve, selection, { type: 'input', entry }),
    save: (solve, selection, value) =>
      reduceSolver(index, solve, selection, { type: 'save', value }),
    keyToAction: (input, selection) => keyToAction(input, selection.view),
    apply: (solve, selection, action) => reduceSolver(index, solve, selection, action),
    // Tab past the last clue (or Shift+Tab before the first) leaves the solver.
    leaves: (input, selection) => {
      if (input.key !== 'Tab') return false;
      const position = index.cluePositionOf(index.clueRefOf(selection.cell).label);
      return input.shiftKey ? position === 0 : position === lastClue;
    },
    targetId: (selection) =>
      selection.view === 'grid' ? gridSquareId(selection.cell) : clueBlankId(selection.cell),
  };
}
