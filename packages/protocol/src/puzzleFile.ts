import { puzzleFromCompact, type Puzzle } from '@acrosticle/core';
import { z } from 'zod';
import { validateWith, type ParseResult } from './parseResult';

/**
 * The puzzle-file format: how puzzles are imported, exported and stored as
 * samples. The grid uses the compact row format (`12V` = square 12, clue V;
 * `#` = black square). Unknown fields (e.g. `$comment`, `errata`) are ignored.
 */
export const PuzzleFile = z.object({
  title: z.string().optional(),
  constructedBy: z.string().optional(),
  source: z.string().optional(),
  grid: z.object({
    columns: z.number().int().positive(),
    rows: z.array(z.string()).min(1),
  }),
  clues: z.array(
    z.object({
      label: z.string(),
      text: z.string(),
      cells: z.array(z.number().int()),
    }),
  ),
});
export type PuzzleFile = z.infer<typeof PuzzleFile>;

/**
 * Reads a decoded puzzle file into a `Puzzle`. Checks shape only; run
 * `validatePuzzle` to check the puzzle's internal consistency.
 */
export function parsePuzzleFile(data: unknown): ParseResult<Puzzle> {
  const file = validateWith(PuzzleFile, data);
  if (!file.ok) return file;
  const result = puzzleFromCompact(file.value);
  return result.ok ? { ok: true, value: result.puzzle } : result;
}
