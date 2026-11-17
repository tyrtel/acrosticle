import type { CellNumber } from '@gridicles/core';
import type { CrosswordBars } from './puzzle';
import type { PrintedNumber } from './reconcile';

/** An answer to place: its clue number, direction and printed length. */
export interface Enumerated {
  readonly number: number;
  readonly direction: 'across' | 'down';
  readonly length: number;
}

/** Search steps before giving up (a 15×15 grid needs a few hundred when the guide is good). */
const MAX_STEPS = 200_000;

/**
 * Works out a barred grid's bars from its clues alone. Every square of a
 * barred grid is white, so the layout is fixed by three rules: clue numbers
 * run in reading order, each numbered square starts exactly the answers with
 * that number (of their printed length), and every square belongs to at
 * least one answer. A depth-first search places the numbers square by square
 * under those rules; `guide` (where a reader saw each number printed) only
 * decides which choice to try first, so a misread position can't produce a
 * layout that contradicts the clues. (Where the clues allow more than one
 * layout, the guide picks between them, else the earliest placement wins.)
 * Returns the bars, or null if no layout fits.
 */
export function solveBarredLayout(
  width: number,
  height: number,
  answers: readonly Enumerated[],
  guide: readonly PrintedNumber[] = [],
): CrosswordBars | null {
  const numbers = [...new Set(answers.map((a) => a.number))].sort((a, b) => a - b);
  const across = new Map(
    answers.filter((a) => a.direction === 'across').map((a) => [a.number, a.length]),
  );
  const down = new Map(
    answers.filter((a) => a.direction === 'down').map((a) => [a.number, a.length]),
  );
  const seenAt = new Map(guide.map((g) => [g.number, (g.row - 1) * width + (g.column - 1)]));
  const total = width * height;

  // acrossId[i] / downId[i]: which answer covers square i (0 = none yet); position within it.
  const acrossOwner = new Int32Array(total);
  const downOwner = new Int32Array(total);
  let steps = 0;

  const place = (owner: Int32Array, start: number, length: number, stride: number, id: number) => {
    for (let k = 0; k < length; k++) owner[start + k * stride] = id;
  };
  const free = (owner: Int32Array, start: number, length: number, stride: number) => {
    for (let k = 0; k < length; k++) if (owner[start + k * stride] !== 0) return false;
    return true;
  };

  const search = (i: number, next: number): boolean => {
    if (++steps > MAX_STEPS) return false;
    if (i === total) return next === numbers.length;
    const row = Math.floor(i / width);
    const column = i % width;
    const covered = acrossOwner[i] !== 0 || downOwner[i] !== 0;
    const n = numbers[next];

    const tryNumbered = (): boolean => {
      if (n === undefined) return false;
      const a = across.get(n);
      const d = down.get(n);
      if (a !== undefined) {
        // An across answer can't start inside another, or run past the edge.
        if (acrossOwner[i] !== 0 || column + a > width || !free(acrossOwner, i, a, 1)) return false;
      }
      if (d !== undefined) {
        if (downOwner[i] !== 0 || row + d > height || !free(downOwner, i, d, width)) return false;
      }
      const id = next + 1;
      if (a !== undefined) place(acrossOwner, i, a, 1, id);
      if (d !== undefined) place(downOwner, i, d, width, id);
      if (search(i + 1, next + 1)) return true;
      if (a !== undefined) place(acrossOwner, i, a, 1, 0);
      if (d !== undefined) place(downOwner, i, d, width, 0);
      return false;
    };
    // An uncovered square can only be covered by an answer starting here.
    const tryPlain = () => covered && search(i + 1, next);

    // Which to try first (both are tried either way): if the reader saw this number further
    // on, wait for it; otherwise place it as early as possible.
    const seen = n === undefined ? undefined : seenAt.get(n);
    const later = seen !== undefined && seen > i;
    return later ? tryPlain() || tryNumbered() : tryNumbered() || tryPlain();
  };

  if (!search(0, 0)) return null;

  // A bar wherever the next square across (or down) isn't part of the same answer.
  const right: CellNumber[] = [];
  const bottom: CellNumber[] = [];
  for (let i = 0; i < total; i++) {
    const column = i % width;
    if (column < width - 1 && (acrossOwner[i] === 0 || acrossOwner[i] !== acrossOwner[i + 1])) {
      right.push(i + 1);
    }
    if (i + width < total && (downOwner[i] === 0 || downOwner[i] !== downOwner[i + width])) {
      bottom.push(i + 1);
    }
  }
  return { right, bottom };
}
