import { puzzleFromCompact, type Puzzle } from '@gridicles/acrostic';
import { MAX_ENTRY_LENGTH } from '@gridicles/core';
import { crosswordFromFile, MAX_CROSSWORD_SIZE, type Crossword } from '@gridicles/crossword';
import { z } from 'zod';
import { validateWith, type ParseResult } from './parseResult';

/**
 * The acrostic file format: how acrostics are imported, exported and stored
 * as samples. The grid uses the compact row format (`12V` = square 12, clue V;
 * `#` = black square). `kind` is optional: files from before crosswords have
 * none. Unknown fields (e.g. `$comment`, `errata`) are ignored.
 */
export const AcrosticFile = z.object({
  kind: z.literal('acrostic').optional(),
  title: z.string().optional(),
  constructedBy: z.string().optional(),
  source: z.string().optional(),
  grid: z.object({
    columns: z.number().int().positive(),
    rows: z.array(z.string()).min(1).readonly(),
  }),
  clues: z
    .array(
      z.object({
        label: z.string(),
        text: z.string(),
        cells: z.array(z.number().int()).readonly(),
      }),
    )
    .readonly(),
});
export type AcrosticFile = z.infer<typeof AcrosticFile>;

const MAX_TEXT = 2_000;
const cellNumber = z.number().int().positive();
const clue = z.object({ number: z.number().int().positive(), text: z.string().max(MAX_TEXT) });

/**
 * The crossword file format (see `CrosswordFileData` in @gridicles/crossword):
 * one string per grid row, `#` black, `.` unknown, or the answer's letter.
 */
export const CrosswordFile = z.object({
  kind: z.literal('crossword'),
  title: z.string().max(MAX_TEXT).optional(),
  author: z.string().max(MAX_TEXT).optional(),
  copyright: z.string().max(MAX_TEXT).optional(),
  notes: z.string().max(MAX_TEXT).optional(),
  grid: z
    .array(
      z
        .string()
        .min(1)
        .max(MAX_CROSSWORD_SIZE * 2),
    )
    .min(1)
    .max(MAX_CROSSWORD_SIZE)
    .readonly(),
  rebus: z.record(z.string(), z.string().min(1).max(MAX_ENTRY_LENGTH)).optional(),
  circled: z.array(cellNumber).readonly().optional(),
  shaded: z.array(cellNumber).readonly().optional(),
  style: z.enum(['standard', 'rows-columns']).optional(),
  bars: z
    .object({
      right: z.array(cellNumber).readonly().optional(),
      bottom: z.array(cellNumber).readonly().optional(),
    })
    .optional(),
  clues: z.object({ across: z.array(clue).readonly(), down: z.array(clue).readonly() }),
});
export type CrosswordFile = z.infer<typeof CrosswordFile>;

/** Any puzzle file. A file without a `kind` is an acrostic. */
export const PuzzleFile = z.union([CrosswordFile, AcrosticFile]);
export type PuzzleFile = z.infer<typeof PuzzleFile>;

export type PuzzleKind = 'acrostic' | 'crossword';

export function puzzleKindOf(file: PuzzleFile): PuzzleKind {
  return file.kind ?? 'acrostic';
}

/** A puzzle file's title, whatever its kind. */
export function puzzleTitleOf(file: PuzzleFile): string | null {
  return file.title ?? null;
}

/**
 * The file as browsers get it: crossword answers removed (they're kept on the
 * server for a future check/reveal, never sent, so nobody can peek).
 */
export function publicPuzzleFile(file: PuzzleFile): PuzzleFile {
  if (file.kind !== 'crossword') return file;
  const { rebus: _rebus, ...rest } = file;
  return {
    ...rest,
    grid: file.grid.map((row) => Array.from(row, (char) => (char === '#' ? '#' : '.')).join('')),
  };
}

/**
 * Reads a decoded acrostic file into a `Puzzle`. Checks shape only; run
 * `validatePuzzle` to check the puzzle's internal consistency.
 */
export function parseAcrosticFile(data: unknown): ParseResult<Puzzle> {
  const file = validateWith(AcrosticFile, data);
  if (!file.ok) return file;
  const result = puzzleFromCompact(file.value);
  return result.ok ? { ok: true, value: result.puzzle } : result;
}

/** Reads a decoded crossword file into a `Crossword`. Checks shape only; run `validateCrossword` too. */
export function parseCrosswordFile(data: unknown): ParseResult<Crossword> {
  const file = validateWith(CrosswordFile, data);
  if (!file.ok) return file;
  const result = crosswordFromFile(file.value);
  return result.ok ? { ok: true, value: result.crossword } : result;
}
