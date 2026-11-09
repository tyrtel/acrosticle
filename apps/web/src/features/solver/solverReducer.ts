import {
  enterLetter,
  erase,
  jumpToClue,
  moveInGrid,
  step,
  type CellEdit,
  type CellNumber,
  type Direction,
  type Letter,
  type PuzzleIndex,
  type Selection,
  type SolveState,
  type View,
} from '@acrosticle/core';

export type SolverAction =
  | { readonly type: 'select'; readonly cell: CellNumber; readonly view: View }
  | { readonly type: 'input'; readonly letter: Letter }
  | { readonly type: 'erase' }
  | { readonly type: 'clear' }
  | { readonly type: 'move'; readonly direction: Direction }
  | { readonly type: 'step'; readonly delta: 1 | -1 }
  | { readonly type: 'jumpClue'; readonly delta: 1 | -1 }
  | { readonly type: 'toggleView' };

/** Where the cursor goes, and the cell edit (if any) to send to the room. */
export interface SolverResult {
  readonly selection: Selection;
  readonly edit: CellEdit | null;
}

export function initialSelection(index: PuzzleIndex): Selection {
  const [first] = index.cells;
  if (first === undefined) throw new Error('Puzzle has no letter squares');
  return { cell: first, view: 'grid' };
}

/** What a solver action does. A thin adapter over the pure functions in core. */
export function reduceSolver(
  index: PuzzleIndex,
  solve: SolveState,
  selection: Selection,
  action: SolverAction,
): SolverResult {
  const move = (next: Selection): SolverResult => ({ selection: next, edit: null });
  switch (action.type) {
    case 'select':
      return move({ cell: action.cell, view: action.view });
    case 'input':
      return enterLetter(index, selection, action.letter);
    case 'erase':
      return erase(index, solve, selection);
    case 'clear':
      return { selection, edit: { cell: selection.cell, value: null } };
    case 'move':
      return move(moveInGrid(index, selection, action.direction));
    case 'step':
      return move(step(index, selection, action.delta));
    case 'jumpClue':
      return move(jumpToClue(index, solve, selection, action.delta));
    case 'toggleView':
      return move({ ...selection, view: selection.view === 'grid' ? 'clue' : 'grid' });
  }
}
