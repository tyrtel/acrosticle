import {
  arrowInCrossword,
  atTabEnd,
  eraseInCrossword,
  jumpInCrossword,
  saveInCrossword,
  toggleDirection,
  typeInCrossword,
  type CrosswordIndex,
  type CrosswordSelection,
} from '@gridicles/crossword';
import type { SolverModel } from '../../components/SolverShell';
import { crosswordSquareId } from './elementIds';
import { keyToCrosswordAction, type CrosswordAction } from './keymap';

/** How the crossword cursor moves, for the shared solver shell (rules in @gridicles/crossword). */
export function crosswordModel(
  index: CrosswordIndex,
): SolverModel<CrosswordSelection, CrosswordAction> {
  return {
    type: (solve, selection, entry) => typeInCrossword(index, solve, selection, entry),
    save: (solve, selection, value) => saveInCrossword(index, solve, selection, value),
    keyToAction: (input) => keyToCrosswordAction(input),
    apply: (solve, selection, action) => {
      switch (action.type) {
        case 'arrow':
          return { edit: null, selection: arrowInCrossword(index, selection, action.arrow) };
        case 'erase':
          return eraseInCrossword(index, solve, selection);
        case 'clear':
          return { edit: { cell: selection.cell, value: null }, selection };
        case 'toggle':
          return { edit: null, selection: toggleDirection(index, selection) };
        case 'jump':
          return { edit: null, selection: jumpInCrossword(index, solve, selection, action.delta) };
      }
    },
    // Tab past the last clue (or Shift+Tab before the first) leaves the solver.
    leaves: (input, selection) =>
      input.key === 'Tab' && atTabEnd(index, selection, input.shiftKey ? -1 : 1),
    targetId: (selection) => crosswordSquareId(selection.cell),
  };
}
