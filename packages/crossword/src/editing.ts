import type { CellNumber } from '@gridicles/core';
import type { Crossword, CrosswordSquare } from './puzzle';
import { MAX_CROSSWORD_SIZE } from './puzzle';

const OPEN: CrosswordSquare = { kind: 'open', solution: null, circled: false, shaded: false };
const BLOCK: CrosswordSquare = { kind: 'block' };

/** The smallest grid the editor allows. */
export const MIN_CROSSWORD_SIZE = 2;

/** A blank crossword: every square open, no clues. */
export function blankCrossword(width: number, height: number): Crossword {
  const w = clampSize(width);
  const h = clampSize(height);
  return {
    width: w,
    height: h,
    squares: Array.from({ length: w * h }, () => OPEN),
    clues: { across: [], down: [] },
  };
}

/**
 * Toggles a square between black and open. With `symmetric`, its mirror
 * square (rotated half a turn, the usual crossword symmetry) follows.
 */
export function toggleBlock(crossword: Crossword, cell: CellNumber, symmetric: boolean): Crossword {
  const index = cell - 1;
  const square = crossword.squares[index];
  if (!square) throw new RangeError(`No square ${cell}`);
  const next = square.kind === 'block' ? OPEN : BLOCK;
  const mirror = crossword.squares.length - 1 - index;
  return {
    ...crossword,
    squares: crossword.squares.map((s, i) =>
      i === index || (symmetric && i === mirror) ? next : s,
    ),
  };
}

/** Resizes the grid, keeping the top-left squares; new squares are open. */
export function resizeCrossword(crossword: Crossword, width: number, height: number): Crossword {
  const w = clampSize(width);
  const h = clampSize(height);
  const squares: CrosswordSquare[] = [];
  for (let row = 0; row < h; row++) {
    for (let column = 0; column < w; column++) {
      const kept =
        row < crossword.height && column < crossword.width
          ? crossword.squares[row * crossword.width + column]
          : undefined;
      squares.push(kept ?? OPEN);
    }
  }
  return { ...crossword, width: w, height: h, squares };
}

function clampSize(size: number): number {
  const whole = Number.isFinite(size) ? Math.round(size) : MIN_CROSSWORD_SIZE;
  return Math.min(MAX_CROSSWORD_SIZE, Math.max(MIN_CROSSWORD_SIZE, whole));
}
