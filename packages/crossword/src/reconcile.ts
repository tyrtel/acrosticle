import { buildCrosswordIndex } from './crosswordIndex';
import type { Crossword, CrosswordSquare, Direction } from './puzzle';
import { solveBarredLayout } from './solveBarred';

/** Where a number is printed in the grid (rows and columns counted from 1). */
export interface PrintedNumber {
  readonly number: number;
  readonly row: number;
  readonly column: number;
}

export interface Reconciled {
  readonly crossword: Crossword;
  /** What was changed, for the creator to check (empty if nothing was). */
  readonly notes: readonly string[];
}

const OPEN: CrosswordSquare = { kind: 'open', solution: null, circled: false, shaded: false };
const BLOCK: CrosswordSquare = { kind: 'block' };

/**
 * Repairs a grid read from a photo using what reads reliably: the clue
 * numbers, the answer lengths printed in clues ("(7)", "(5,3)"), and where
 * each number is printed. Each answer must start at its number and run for
 * its length, so the squares it covers are open, a black square (or, in a
 * barred grid, a bar) ends it, and no bar falls inside it.
 *
 * The repair is kept only if the grid's numbering then matches the clues
 * better than before; otherwise the grid is returned as read. Puzzles
 * without printed lengths (most American ones) are left alone.
 */
export function reconcileWithClues(
  crossword: Crossword,
  printed: readonly PrintedNumber[],
): Reconciled {
  if (crossword.style === 'rows-columns') return { crossword, notes: [] };
  const { width, height } = crossword;
  // Barred if any bars were read (a reader sees a barred grid's bars, if not all of them). A grid
  // with neither bars nor black squares is more likely a misread ordinary one.
  const barred = (crossword.bars?.right.length ?? 0) + (crossword.bars?.bottom.length ?? 0) > 0;
  // A barred grid whose every clue has a length can be laid out from the clues alone, which is
  // far more reliable than reading thin bars from a photo.
  const allLengths = (['across', 'down'] as const).every((d) =>
    crossword.clues[d].every((clue) => printedLength(clue.text) !== null),
  );
  if (barred && allLengths) {
    const bars = solveBarredLayout(
      width,
      height,
      (['across', 'down'] as const).flatMap((direction) =>
        crossword.clues[direction].map((clue) => ({
          number: clue.number,
          direction,
          length: printedLength(clue.text) ?? 0,
        })),
      ),
      printed,
    );
    if (bars) {
      const solved: Crossword = { ...crossword, squares: crossword.squares.map(() => OPEN), bars };
      if (agreement(solved) > agreement(crossword)) {
        return {
          crossword: solved,
          notes: [
            'Laid out the bars from the clue numbers and answer lengths; check them against the photo.',
          ],
        };
      }
    }
  }

  const where = new Map(printed.map((p) => [p.number, p]));
  const answers = (['across', 'down'] as const).flatMap((direction) =>
    crossword.clues[direction].flatMap((clue) => {
      const length = printedLength(clue.text);
      const at = where.get(clue.number);
      return length && at ? [{ direction, length, row: at.row - 1, column: at.column - 1 }] : [];
    }),
  );
  if (answers.length === 0) return { crossword, notes: [] };

  const squares = [...crossword.squares];
  const right = new Set(crossword.bars?.right ?? []);
  const bottom = new Set(crossword.bars?.bottom ?? []);
  const mustBeOpen = new Set<number>();
  const cell = (row: number, column: number) => row * width + column + 1;
  const inside = (row: number, column: number) =>
    row >= 0 && row < height && column >= 0 && column < width;

  // First, every square an answer covers is open (and stays open).
  for (const a of answers) {
    for (let k = 0; k < a.length; k++) {
      const [r, c] = step(a.direction, a.row, a.column, k);
      if (inside(r, c)) mustBeOpen.add(cell(r, c));
    }
  }
  for (const n of mustBeOpen) squares[n - 1] = OPEN;

  // Then each answer is ended on both sides, and has no bar inside it.
  for (const a of answers) {
    const bars = a.direction === 'across' ? right : bottom;
    for (let k = 0; k < a.length - 1; k++) {
      const [r, c] = step(a.direction, a.row, a.column, k);
      if (inside(r, c)) bars.delete(cell(r, c));
    }
    const [lastRow, lastColumn] = step(a.direction, a.row, a.column, a.length - 1);
    const [afterRow, afterColumn] = step(a.direction, a.row, a.column, a.length);
    const [beforeRow, beforeColumn] = step(a.direction, a.row, a.column, -1);
    if (barred) {
      if (inside(afterRow, afterColumn) && inside(lastRow, lastColumn))
        bars.add(cell(lastRow, lastColumn));
      if (inside(beforeRow, beforeColumn)) bars.add(cell(beforeRow, beforeColumn));
    } else {
      for (const [r, c] of [
        [afterRow, afterColumn],
        [beforeRow, beforeColumn],
      ] as const) {
        if (inside(r, c) && !mustBeOpen.has(cell(r, c))) squares[cell(r, c) - 1] = BLOCK;
      }
    }
  }

  const repaired: Crossword = {
    ...crossword,
    squares,
    ...(barred && {
      bars: { right: [...right].sort((a, b) => a - b), bottom: [...bottom].sort((a, b) => a - b) },
    }),
  };
  const before = agreement(crossword);
  const after = agreement(repaired);
  if (after <= before) return { crossword, notes: [] };

  const changedSquares = squares.filter((s, i) => s.kind !== crossword.squares[i]?.kind).length;
  const changedBars =
    symmetricDifference(right, crossword.bars?.right) +
    symmetricDifference(bottom, crossword.bars?.bottom);
  const changes = [
    changedSquares > 0 && `${changedSquares} square${changedSquares === 1 ? '' : 's'}`,
    changedBars > 0 && `${changedBars} bar${changedBars === 1 ? '' : 's'}`,
  ].filter(Boolean);
  return {
    crossword: repaired,
    notes: [
      `Adjusted ${changes.join(' and ')} so the grid fits the clue numbers and answer lengths; check the grid against the photo.`,
    ],
  };
}

/** The answer length printed at the end of a clue: "(5)", or "(3,4)" / "(3-4)" for phrases. */
export function printedLength(text: string): number | null {
  const match = /\((\d+(?:[,\s-]+\d+)*)\)\s*$/.exec(text);
  if (!match?.[1]) return null;
  return match[1].split(/[,\s-]+/).reduce((sum, part) => sum + Number(part), 0);
}

/**
 * How well a grid's own numbering matches its clue numbers, from 0 to 1 (1:
 * exactly the same numbers). Null when there are no numbered clues to check
 * against (a grid-only photo, or rows and columns).
 */
export function clueNumberFit(crossword: Crossword): number | null {
  if (crossword.style === 'rows-columns') return null;
  const index = buildCrosswordIndex(crossword);
  const fits = (['across', 'down'] as Direction[]).flatMap((direction) => {
    const clues = new Set(crossword.clues[direction].map((c) => c.number));
    if (clues.size === 0) return [];
    const words = new Set(index.words(direction).map((w) => w.number));
    const all = new Set([...clues, ...words]);
    let shared = 0;
    for (const n of clues) if (words.has(n)) shared++;
    return [shared / all.size];
  });
  return fits.length === 0 ? null : fits.reduce((a, b) => a + b, 0) / fits.length;
}

/** How many clue numbers the grid's own numbering produces (higher is better). */
function agreement(crossword: Crossword): number {
  const index = buildCrosswordIndex(crossword);
  let score = 0;
  for (const direction of ['across', 'down'] as Direction[]) {
    const numbers = new Set(index.words(direction).map((w) => w.number));
    for (const clue of crossword.clues[direction]) if (numbers.has(clue.number)) score++;
    score -= [...numbers].filter(
      (n) => !crossword.clues[direction].some((c) => c.number === n),
    ).length;
  }
  return score;
}

function step(direction: Direction, row: number, column: number, k: number): [number, number] {
  return direction === 'across' ? [row, column + k] : [row + k, column];
}

function symmetricDifference(now: ReadonlySet<number>, was: readonly number[] = []): number {
  const before = new Set(was);
  let count = 0;
  for (const n of now) if (!before.has(n)) count++;
  for (const n of before) if (!now.has(n)) count++;
  return count;
}
