import type { CellNumber, Clue, ClueLabel, GridSquare, Puzzle } from './puzzle';
import { hasErrors, validatePuzzle } from './validatePuzzle';

/** Where a cell sits in its clue's answer. */
export interface ClueRef {
  readonly label: ClueLabel;
  /** 0-based position of the cell within the clue's blanks. */
  readonly position: number;
}

/**
 * Fast lookups over a valid puzzle. Built once per puzzle and shared by the
 * grid view, the clue view and navigation.
 */
export interface PuzzleIndex {
  readonly puzzle: Puzzle;
  /** Entry cells in grid reading order. */
  readonly cells: readonly CellNumber[];
  readonly clues: readonly Clue[];
  squareAt(gridIndex: number): GridSquare | undefined;
  gridIndexOf(cell: CellNumber): number;
  /** 0-based position of the cell in grid reading order (index into `cells`). */
  readingPositionOf(cell: CellNumber): number;
  clueRefOf(cell: CellNumber): ClueRef;
  clue(label: ClueLabel): Clue;
  /** 0-based position of the clue in `clues`. */
  cluePositionOf(label: ClueLabel): number;
  /** The grid word (run of letter squares between black squares) containing the cell. */
  wordOf(cell: CellNumber): readonly CellNumber[];
}

/**
 * Builds the index. The puzzle must pass `validatePuzzle` without errors;
 * drafts with errors belong in the review screen, not the solver.
 */
export function buildPuzzleIndex(puzzle: Puzzle): PuzzleIndex {
  if (hasErrors(validatePuzzle(puzzle))) {
    throw new Error(
      'Cannot index a puzzle with validation errors. Fix the validatePuzzle() errors first.',
    );
  }

  const { squares } = puzzle.grid;
  const cells: CellNumber[] = [];
  const gridIndexByCell = new Map<CellNumber, number>();
  const readingPositionByCell = new Map<CellNumber, number>();
  const wordByCell = new Map<CellNumber, readonly CellNumber[]>();

  let word: CellNumber[] = [];
  const endWord = () => {
    for (const cell of word) wordByCell.set(cell, word);
    word = [];
  };

  squares.forEach((square, gridIndex) => {
    switch (square.kind) {
      case 'letter':
        readingPositionByCell.set(square.number, cells.length);
        cells.push(square.number);
        gridIndexByCell.set(square.number, gridIndex);
        word.push(square.number);
        return;
      case 'block':
        endWord();
        return;
      case 'punctuation':
        // Punctuation sits between letters without breaking the word (e.g. DON'T).
        return;
    }
  });
  endWord();

  const clueByLabel = new Map<ClueLabel, Clue>();
  const cluePositionByLabel = new Map<ClueLabel, number>();
  const clueRefByCell = new Map<CellNumber, ClueRef>();
  puzzle.clues.forEach((clue, cluePosition) => {
    clueByLabel.set(clue.label, clue);
    cluePositionByLabel.set(clue.label, cluePosition);
    clue.cells.forEach((cell, position) =>
      clueRefByCell.set(cell, { label: clue.label, position }),
    );
  });

  return {
    puzzle,
    cells,
    clues: puzzle.clues,
    squareAt: (gridIndex) => squares[gridIndex],
    gridIndexOf: (cell) => lookup(gridIndexByCell, cell, 'cell'),
    readingPositionOf: (cell) => lookup(readingPositionByCell, cell, 'cell'),
    clueRefOf: (cell) => lookup(clueRefByCell, cell, 'cell'),
    clue: (label) => lookup(clueByLabel, label, 'clue'),
    cluePositionOf: (label) => lookup(cluePositionByLabel, label, 'clue'),
    wordOf: (cell) => lookup(wordByCell, cell, 'cell'),
  };
}

function lookup<K, V>(map: ReadonlyMap<K, V>, key: K, kind: string): V {
  const value = map.get(key);
  if (value === undefined) {
    throw new RangeError(`Unknown ${kind}: ${String(key)}`);
  }
  return value;
}
