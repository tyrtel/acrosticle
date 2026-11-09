import type { CompactPuzzle } from './compactGrid';
import type { Clue, ClueLabel, Grid, GridSquare, Puzzle } from './puzzle';
import type { SuggestedFix } from './validatePuzzle';

/** Returns a copy of the puzzle with one grid square replaced. */
export function replaceSquare(puzzle: Puzzle, gridIndex: number, square: GridSquare): Puzzle {
  const { squares } = puzzle.grid;
  if (!Number.isInteger(gridIndex) || gridIndex < 0 || gridIndex >= squares.length) {
    throw new RangeError(`Grid index out of range: ${gridIndex}`);
  }
  return {
    ...puzzle,
    grid: { ...puzzle.grid, squares: squares.map((s, i) => (i === gridIndex ? square : s)) },
  };
}

/** Returns a copy of the puzzle with one clue's text and/or blanks changed. */
export function updateClue(
  puzzle: Puzzle,
  label: ClueLabel,
  changes: Partial<Pick<Clue, 'text' | 'cells'>>,
): Puzzle {
  if (!puzzle.clues.some((clue) => clue.label === label)) {
    throw new RangeError(`Unknown clue: ${label}`);
  }
  return {
    ...puzzle,
    clues: puzzle.clues.map((clue) => (clue.label === label ? { ...clue, ...changes } : clue)),
  };
}

/** Applies a fix suggested by `validatePuzzle`. */
export function applyFix(puzzle: Puzzle, fix: SuggestedFix): Puzzle {
  const square = puzzle.grid.squares[fix.gridIndex];
  if (square?.kind !== 'letter') {
    throw new RangeError(`Fix targets grid index ${fix.gridIndex}, which is not a letter square`);
  }
  return replaceSquare(puzzle, fix.gridIndex, { ...square, clue: fix.label });
}

/** Writes a grid in the compact row format (the inverse of `parseCompactGrid`). */
export function formatCompactGrid(grid: Grid): string[] {
  const tokens = grid.squares.map(formatToken);
  const rows: string[] = [];
  for (let i = 0; i < tokens.length; i += grid.columns) {
    rows.push(tokens.slice(i, i + grid.columns).join(' '));
  }
  return rows;
}

/** Converts a puzzle to the compact, puzzle-file shape (for export). */
export function puzzleToCompact(puzzle: Puzzle): CompactPuzzle {
  return {
    ...(puzzle.title !== undefined && { title: puzzle.title }),
    ...(puzzle.constructedBy !== undefined && { constructedBy: puzzle.constructedBy }),
    ...(puzzle.source !== undefined && { source: puzzle.source }),
    grid: { columns: puzzle.grid.columns, rows: formatCompactGrid(puzzle.grid) },
    clues: puzzle.clues,
  };
}

function formatToken(square: GridSquare): string {
  switch (square.kind) {
    case 'letter':
      return `${square.number}${square.clue}`;
    case 'block':
      return '#';
    case 'punctuation':
      return square.char;
  }
}
