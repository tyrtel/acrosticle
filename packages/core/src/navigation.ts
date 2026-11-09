import type { Letter } from './letters';
import type { CellNumber, ClueLabel } from './puzzle';
import type { PuzzleIndex } from './puzzleIndex';
import { getCell, type CellEdit, type SolveState } from './solveState';

/** Which view the solver is typing in. It decides where the cursor moves next. */
export type View = 'grid' | 'clue';

/**
 * The cursor. A cell belongs to exactly one grid square and one clue blank,
 * so a cell plus the active view is enough to place the cursor in both views.
 */
export interface Selection {
  readonly cell: CellNumber;
  readonly view: View;
}

/** What a key press does: an optional change to one cell, and where the cursor goes. */
export interface EditResult {
  readonly edit: CellEdit | null;
  readonly selection: Selection;
}

export type Direction = 'up' | 'down' | 'left' | 'right';

/** Everything the UI highlights for a selection. */
export interface SelectionContext {
  readonly cell: CellNumber;
  readonly clue: ClueLabel;
  /** Position of the cell in the clue's blanks. */
  readonly position: number;
  readonly clueCells: readonly CellNumber[];
  readonly wordCells: readonly CellNumber[];
}

export function describeSelection(index: PuzzleIndex, selection: Selection): SelectionContext {
  const { label, position } = index.clueRefOf(selection.cell);
  return {
    cell: selection.cell,
    clue: label,
    position,
    clueCells: index.clue(label).cells,
    wordCells: index.wordOf(selection.cell),
  };
}

/**
 * Moves one cell forward or back within the active view: grid reading order
 * in the grid, answer order in a clue. Stops at the ends.
 */
export function step(index: PuzzleIndex, selection: Selection, delta: 1 | -1): Selection {
  const { order, position } = orderFor(index, selection);
  const next = order[position + delta];
  return next === undefined ? selection : { ...selection, cell: next };
}

/**
 * Arrow-key movement in the grid. Left/right follow reading order (wrapping
 * across rows); up/down move by column, skipping black squares.
 */
export function moveInGrid(
  index: PuzzleIndex,
  selection: Selection,
  direction: Direction,
): Selection {
  const inGrid: Selection = { cell: selection.cell, view: 'grid' };
  switch (direction) {
    case 'left':
      return step(index, inGrid, -1);
    case 'right':
      return step(index, inGrid, 1);
    case 'up':
    case 'down': {
      const { columns } = index.puzzle.grid;
      const delta = direction === 'up' ? -columns : columns;
      for (let i = index.gridIndexOf(selection.cell) + delta; ; i += delta) {
        const square = index.squareAt(i);
        if (square === undefined) return inGrid;
        if (square.kind === 'letter') return { cell: square.number, view: 'grid' };
      }
    }
  }
}

/**
 * Moves to the next or previous clue (wrapping around), landing on its first
 * empty blank, or its first blank if the clue is full.
 */
export function jumpToClue(
  index: PuzzleIndex,
  state: SolveState,
  selection: Selection,
  delta: 1 | -1,
): Selection {
  const { clues } = index;
  const current = index.cluePositionOf(index.clueRefOf(selection.cell).label);
  const target = clues[(current + delta + clues.length) % clues.length];
  const cells = target?.cells ?? [];
  const cell = cells.find((c) => getCell(state, c) === null) ?? cells[0] ?? selection.cell;
  return { cell, view: 'clue' };
}

/** Types a letter at the cursor, then advances within the active view. */
export function enterLetter(index: PuzzleIndex, selection: Selection, letter: Letter): EditResult {
  return {
    edit: { cell: selection.cell, value: letter },
    selection: step(index, selection, 1),
  };
}

/**
 * Backspace: clears the cell at the cursor; if it's already empty, moves back
 * one cell in the active view and clears that one.
 */
export function erase(index: PuzzleIndex, state: SolveState, selection: Selection): EditResult {
  if (getCell(state, selection.cell) !== null) {
    return { edit: { cell: selection.cell, value: null }, selection };
  }
  const previous = step(index, selection, -1);
  if (previous.cell === selection.cell) return { edit: null, selection };
  const edit = getCell(state, previous.cell) === null ? null : { cell: previous.cell, value: null };
  return { edit, selection: previous };
}

/**
 * The first letter of each clue's answer, in clue order. When solved these
 * spell the author and title of the quotation's source.
 */
export function acrosticLetters(index: PuzzleIndex, state: SolveState): (Letter | null)[] {
  return index.clues.map((clue) => {
    const first = clue.cells[0];
    return first === undefined ? null : getCell(state, first);
  });
}

function orderFor(
  index: PuzzleIndex,
  selection: Selection,
): { order: readonly CellNumber[]; position: number } {
  if (selection.view === 'grid') {
    return { order: index.cells, position: index.readingPositionOf(selection.cell) };
  }
  const { label, position } = index.clueRefOf(selection.cell);
  return { order: index.clue(label).cells, position };
}
