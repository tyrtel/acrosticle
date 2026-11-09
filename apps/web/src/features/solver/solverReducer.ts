import {
  enterLetter,
  erase,
  jumpToClue,
  moveInGrid,
  setCell,
  step,
  type CellNumber,
  type Direction,
  type EditResult,
  type Letter,
  type PuzzleIndex,
  type Selection,
  type SolveState,
  type View,
} from '@acrosticle/core';

export interface SolverState {
  readonly solve: SolveState;
  readonly selection: Selection;
}

export type SolverAction =
  | { readonly type: 'select'; readonly cell: CellNumber; readonly view: View }
  | { readonly type: 'input'; readonly letter: Letter }
  | { readonly type: 'erase' }
  | { readonly type: 'clear' }
  | { readonly type: 'move'; readonly direction: Direction }
  | { readonly type: 'step'; readonly delta: 1 | -1 }
  | { readonly type: 'jumpClue'; readonly delta: 1 | -1 }
  | { readonly type: 'toggleView' };

export function initialSolverState(index: PuzzleIndex, solve: SolveState): SolverState {
  const [first] = index.cells;
  if (first === undefined) throw new Error('Puzzle has no letter squares');
  return { solve, selection: { cell: first, view: 'grid' } };
}

/** All solver state changes. A thin adapter over the pure functions in core. */
export function reduceSolver(
  index: PuzzleIndex,
  state: SolverState,
  action: SolverAction,
): SolverState {
  const { solve, selection } = state;
  switch (action.type) {
    case 'select':
      return { solve, selection: { cell: action.cell, view: action.view } };
    case 'input':
      return fromEdit(enterLetter(index, solve, selection, action.letter));
    case 'erase':
      return fromEdit(erase(index, solve, selection));
    case 'clear':
      return { solve: setCell(solve, selection.cell, null), selection };
    case 'move':
      return { solve, selection: moveInGrid(index, selection, action.direction) };
    case 'step':
      return { solve, selection: step(index, selection, action.delta) };
    case 'jumpClue':
      return { solve, selection: jumpToClue(index, solve, selection, action.delta) };
    case 'toggleView':
      return {
        solve,
        selection: { ...selection, view: selection.view === 'grid' ? 'clue' : 'grid' },
      };
  }
}

function fromEdit({ state, selection }: EditResult): SolverState {
  return { solve: state, selection };
}
