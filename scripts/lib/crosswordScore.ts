/** Scores a crossword read from a photo against an answer key (see scripts/eval-crossword.ts). */
import {
  buildCrosswordIndex,
  crosswordFromFile,
  type CrosswordFileData,
} from '@gridicles/crossword';

/** What's known to be right about a sample photo: its layout, and the clue numbers it prints. */
export interface CrosswordTruth {
  readonly style: 'standard' | 'rows-columns';
  readonly width: number;
  readonly height: number;
  /** Black (#) and white (.) squares, when transcribed. */
  readonly grid?: readonly string[];
  /** The printed clue numbers (empty when the photo has no clues). */
  readonly across: readonly number[];
  readonly down: readonly number[];
}

export interface CrosswordScore {
  readonly sizeRight: boolean;
  readonly styleRight: boolean;
  /** Share of squares read right (black or white), when the key has a grid and the size is right. */
  readonly squares: number | null;
  /**
   * How well the grid read (with its bars) numbers the words, against the
   * printed clue numbers: 1 = exactly the same numbers. Null without clues.
   */
  readonly numbering: number | null;
  /** How well the clue numbers read match the printed ones. Null without clues. */
  readonly clues: number | null;
}

export function scoreCrossword(parsed: CrosswordFileData, truth: CrosswordTruth): CrosswordScore {
  const rows = parsed.grid;
  const width = Array.from(rows[0] ?? '').length;
  const sizeRight = width === truth.width && rows.length === truth.height;
  const styleRight = (parsed.style ?? 'standard') === truth.style;

  let squares: number | null = null;
  if (truth.grid && sizeRight) {
    let right = 0;
    truth.grid.forEach((row, r) =>
      Array.from(row).forEach((square, c) => {
        if ((Array.from(rows[r] ?? '')[c] === '#') === (square === '#')) right++;
      }),
    );
    squares = right / (truth.width * truth.height);
  }

  const printed = truth.across.length + truth.down.length > 0;
  let numbering: number | null = null;
  if (printed) {
    const read = crosswordFromFile(parsed);
    if (read.ok) {
      const index = buildCrosswordIndex(read.crossword);
      numbering = mean(
        overlap(
          index.words('across').map((w) => w.number),
          truth.across,
        ),
        overlap(
          index.words('down').map((w) => w.number),
          truth.down,
        ),
      );
    } else {
      numbering = 0;
    }
  }
  const clues = printed
    ? mean(
        overlap(
          parsed.clues.across.map((c) => c.number),
          truth.across,
        ),
        overlap(
          parsed.clues.down.map((c) => c.number),
          truth.down,
        ),
      )
    : null;

  return { sizeRight, styleRight, squares, numbering, clues };
}

/** Jaccard overlap of two sets of numbers: shared / all (1 when both are empty). */
export function overlap(a: readonly number[], b: readonly number[]): number {
  const left = new Set(a);
  const right = new Set(b);
  const all = new Set([...left, ...right]);
  if (all.size === 0) return 1;
  let shared = 0;
  for (const n of left) if (right.has(n)) shared++;
  return shared / all.size;
}

function mean(...values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}
