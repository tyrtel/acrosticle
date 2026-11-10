/** Scores a parsed puzzle file against a hand-made "as printed" transcription. Pure. */
import type { PuzzleFile } from '@acrosticle/protocol';

export interface Score {
  /** Share of grid squares (in reading order) with the right kind and number. */
  readonly squareNumbers: number;
  /** Share of letter squares whose clue label also matches. */
  readonly squareLabels: number;
  /** Share of clues whose blank list matches exactly. */
  readonly clueBlanks: number;
  /** Average similarity of clue texts (1 = identical, ignoring case and spacing). */
  readonly clueText: number;
  /** Whether the grid has the same number of squares and columns. */
  readonly sameShape: boolean;
}

export function scoreParse(parsed: PuzzleFile, truth: PuzzleFile): Score {
  const got = tokens(parsed);
  const want = tokens(truth);
  let numberHits = 0;
  let labelHits = 0;
  let letterSquares = 0;
  want.forEach((expected, i) => {
    const actual = got[i];
    const e = splitToken(expected);
    const a = actual === undefined ? null : splitToken(actual);
    if (a && a.number === e.number) numberHits += 1;
    if (e.label !== null) {
      letterSquares += 1;
      if (a && a.number === e.number && a.label === e.label) labelHits += 1;
    }
  });

  const clues = new Map(parsed.clues.map((clue) => [clue.label, clue]));
  let blankHits = 0;
  let textTotal = 0;
  for (const clue of truth.clues) {
    const mine = clues.get(clue.label);
    if (mine && mine.cells.join(' ') === clue.cells.join(' ')) blankHits += 1;
    textTotal += mine ? similarity(mine.text, clue.text) : 0;
  }

  return {
    squareNumbers: ratio(numberHits, want.length),
    squareLabels: ratio(labelHits, letterSquares),
    clueBlanks: ratio(blankHits, truth.clues.length),
    clueText: ratio(textTotal, truth.clues.length),
    sameShape: got.length === want.length && parsed.grid.columns === truth.grid.columns,
  };
}

/** 1 for identical strings (ignoring case and runs of spaces), down to 0. */
export function similarity(a: string, b: string): number {
  const x = normalize(a);
  const y = normalize(b);
  if (x === y) return 1;
  const longest = Math.max(x.length, y.length);
  return longest === 0 ? 1 : 1 - levenshtein(x, y) / longest;
}

function tokens(file: PuzzleFile): string[] {
  return file.grid.rows.flatMap((row) => row.trim().split(/\s+/).filter(Boolean));
}

function splitToken(token: string): { number: string; label: string | null } {
  const match = /^(\d+)([A-Z]+)$/.exec(token);
  return match?.[1] && match[2]
    ? { number: match[1], label: match[2] }
    : { number: token, label: null };
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

function levenshtein(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(
        (previous[j] ?? 0) + 1,
        (current[j - 1] ?? 0) + 1,
        (previous[j - 1] ?? 0) + cost,
      );
    }
    previous = current;
  }
  return previous[b.length] ?? 0;
}

function ratio(hits: number, total: number): number {
  return total === 0 ? 1 : hits / total;
}
