import fixture from '../../../../samples/puzzles/diplo-crostic-37.json';
import {
  normalizeEntry,
  parseCompactGrid,
  puzzleFromCompact,
  type Entry,
  type Puzzle,
} from '../../src';

/** Builds a puzzle from the compact grid format, failing loudly on bad test data. */
export function makePuzzle(
  columns: number,
  rows: readonly string[],
  clues: Readonly<Record<string, readonly number[]>>,
): Puzzle {
  const parsed = parseCompactGrid(columns, rows);
  if (!parsed.ok) throw new Error(`Bad test grid: ${parsed.error}`);
  return {
    grid: parsed.grid,
    clues: Object.entries(clues).map(([label, cells]) => ({ label, text: `Clue ${label}`, cells })),
  };
}

/**
 * A small valid puzzle:
 *
 *   1A 2B  #  3A
 *   4B  #  5A
 *
 * Clue A = cells 3, 1, 5. Clue B = cells 4, 2.
 */
export function tinyPuzzle(): Puzzle {
  return makePuzzle(4, ['1A 2B # 3A', '4B # 5A'], { A: [3, 1, 5], B: [4, 2] });
}

/**
 * The hand-transcribed sample puzzle (Diplo-Crostic No. 37).
 * With `asPrinted`, the original misprints are put back (see the fixture's errata).
 */
export function diploCrostic37({ asPrinted = false } = {}): Puzzle {
  const rows = asPrinted
    ? fixture.grid.rows.map((row) =>
        fixture.errata.reduce(
          (r, e) => r.replace(new RegExp(`\\b${e.corrected}\\b`), e.printed),
          row,
        ),
      )
    : fixture.grid.rows;
  const result = puzzleFromCompact({ ...fixture, grid: { ...fixture.grid, rows } });
  if (!result.ok) throw new Error(`Bad fixture: ${result.error}`);
  return result.puzzle;
}

/** Converts a test string to a Entry, failing loudly on bad test data. */
export function letter(s: string): Entry {
  const l = normalizeEntry(s);
  if (!l) throw new Error(`Bad test letter: ${s}`);
  return l;
}
