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

/**
 * Toggles the bar on a square's right or bottom edge (barred grids). With
 * `symmetric`, the mirror bar (rotated half a turn) follows.
 */
export function toggleBar(
  crossword: Crossword,
  cell: CellNumber,
  side: 'right' | 'bottom',
  symmetric: boolean,
): Crossword {
  const { width, height } = crossword;
  const index = cell - 1;
  if (index < 0 || index >= width * height) throw new RangeError(`No square ${cell}`);
  const row = Math.floor(index / width);
  const column = index % width;
  // A bar between this square and the next mirrors to the one between their mirror squares.
  const mirror =
    side === 'right'
      ? (height - 1 - row) * width + (width - 2 - column) + 1
      : (height - 2 - row) * width + (width - 1 - column) + 1;
  const current = new Set(crossword.bars?.[side] ?? []);
  const on = !current.has(cell);
  for (const target of symmetric ? [cell, mirror] : [cell]) {
    if (target < 1 || target > width * height) continue;
    if (on) current.add(target);
    else current.delete(target);
  }
  const bars = {
    right:
      side === 'right' ? [...current].sort((a, b) => a - b) : [...(crossword.bars?.right ?? [])],
    bottom:
      side === 'bottom' ? [...current].sort((a, b) => a - b) : [...(crossword.bars?.bottom ?? [])],
  };
  return { ...crossword, bars };
}

/** Resizes the grid, keeping the top-left squares (and their bars); new squares are open. */
export function resizeCrossword(crossword: Crossword, width: number, height: number): Crossword {
  const w = clampSize(width);
  const h = clampSize(height);
  // Cell numbers depend on the width, so bars move with their row and column.
  const move = (cells: readonly CellNumber[] = []) =>
    cells.flatMap((cell) => {
      const row = Math.floor((cell - 1) / crossword.width);
      const column = (cell - 1) % crossword.width;
      return row < h && column < w ? [row * w + column + 1] : [];
    });
  const bars = crossword.bars && {
    bars: { right: move(crossword.bars.right), bottom: move(crossword.bars.bottom) },
  };
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
  return { ...crossword, ...bars, width: w, height: h, squares };
}

function clampSize(size: number): number {
  const whole = Number.isFinite(size) ? Math.round(size) : MIN_CROSSWORD_SIZE;
  return Math.min(MAX_CROSSWORD_SIZE, Math.max(MIN_CROSSWORD_SIZE, whole));
}
