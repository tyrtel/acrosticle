import { z } from 'zod';
import { PuzzleFile } from './puzzleFile';

/** Response to `POST /api/puzzles/parse`: a draft puzzle read from an image, to review. */
export const ParsePuzzleResponse = z.object({
  file: PuzzleFile,
  /** What Claude was unsure about. */
  notes: z.array(z.string()),
  /** Validation problems in the draft (as printed); the review screen shows and fixes them. */
  issues: z.array(
    z.object({
      code: z.string(),
      severity: z.enum(['error', 'warning', 'info']),
      message: z.string(),
    }),
  ),
  /** Whether any issue is an error that must be fixed before solving. */
  needsFixes: z.boolean(),
  /** What this parse cost, for the record (null if the model's price is unknown). */
  costUsd: z.number().nullable(),
});
export type ParsePuzzleResponse = z.infer<typeof ParsePuzzleResponse>;
