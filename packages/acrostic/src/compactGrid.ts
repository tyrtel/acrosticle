import type { Clue, Grid, GridSquare, Puzzle } from './puzzle';

/**
 * A compact, human-readable grid format: one string per row, tokens separated
 * by spaces.
 *
 * - `12V`: letter square 12, clue V
 * - `#`: black square
 * - any single other symbol (e.g. `,` or `'`): punctuation
 *
 * Used for hand-written fixtures and JSON import. Every row must have exactly
 * `columns` tokens except the last, which may be shorter.
 */
export type CompactGridResult = { ok: true; grid: Grid } | { ok: false; error: string };

const LETTER_TOKEN = /^(\d+)([A-Z]+)$/;
const PUNCTUATION_TOKEN = /^[^A-Za-z0-9#\s]$/;

export function parseCompactGrid(columns: number, rows: readonly string[]): CompactGridResult {
  if (!Number.isInteger(columns) || columns < 1) {
    return { ok: false, error: `Columns must be a positive whole number, got ${columns}` };
  }
  if (rows.length === 0) {
    return { ok: false, error: 'The grid has no rows' };
  }

  const squares: GridSquare[] = [];
  for (const [r, row] of rows.entries()) {
    const tokens = row.trim().split(/\s+/).filter(Boolean);
    const isLast = r === rows.length - 1;
    if (tokens.length > columns || (!isLast && tokens.length < columns) || tokens.length === 0) {
      return {
        ok: false,
        error: `Row ${r + 1} has ${tokens.length} squares; expected ${isLast ? `1–${columns}` : columns}`,
      };
    }
    for (const token of tokens) {
      const square = parseToken(token);
      if (!square) return { ok: false, error: `Row ${r + 1}: unrecognized square "${token}"` };
      squares.push(square);
    }
  }
  return { ok: true, grid: { columns, squares } };
}

/** A puzzle whose grid is written in the compact row format (the puzzle-file shape). */
export interface CompactPuzzle {
  readonly title?: string | undefined;
  readonly constructedBy?: string | undefined;
  readonly source?: string | undefined;
  readonly grid: { readonly columns: number; readonly rows: readonly string[] };
  readonly clues: readonly Clue[];
}

export type CompactPuzzleResult = { ok: true; puzzle: Puzzle } | { ok: false; error: string };

/** Converts a compact puzzle to a `Puzzle`. Shape only: run `validatePuzzle` for consistency. */
export function puzzleFromCompact(compact: CompactPuzzle): CompactPuzzleResult {
  const parsed = parseCompactGrid(compact.grid.columns, compact.grid.rows);
  if (!parsed.ok) return parsed;
  return {
    ok: true,
    puzzle: {
      ...(compact.title !== undefined && { title: compact.title }),
      ...(compact.constructedBy !== undefined && { constructedBy: compact.constructedBy }),
      ...(compact.source !== undefined && { source: compact.source }),
      grid: parsed.grid,
      clues: compact.clues,
    },
  };
}

function parseToken(token: string): GridSquare | null {
  if (token === '#') return { kind: 'block' };
  const letter = LETTER_TOKEN.exec(token);
  if (letter?.[1] && letter[2]) {
    return { kind: 'letter', number: Number(letter[1]), clue: letter[2] };
  }
  if (PUNCTUATION_TOKEN.test(token)) return { kind: 'punctuation', char: token };
  return null;
}
