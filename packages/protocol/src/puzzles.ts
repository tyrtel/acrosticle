import { z } from 'zod';
import { AcrosticFile, CrosswordFile } from './puzzleFile';

/** Response to `POST /api/puzzles/parse`: a draft puzzle read from an image, to review. */
export const ParsePuzzleResponse = z.object({
  file: AcrosticFile,
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

const clue = z.object({ number: z.number().int().positive(), text: z.string() });

/** Body of `POST /api/crosswords/clues`: messy clue text for Claude to sort into clues. */
export const TidyCluesRequest = z.object({ text: z.string().trim().min(1).max(30_000) });
export type TidyCluesRequest = z.infer<typeof TidyCluesRequest>;

/** Response to `POST /api/crosswords/clues`. */
export const TidyCluesResponse = z.object({
  clues: z.object({ across: z.array(clue), down: z.array(clue) }),
  /** What Claude was unsure about. */
  notes: z.array(z.string()),
  costUsd: z.number().nullable(),
});
export type TidyCluesResponse = z.infer<typeof TidyCluesResponse>;

/** Response to `POST /api/crosswords/parse`: a draft crossword read from an image, for the editor. */
export const ParseCrosswordResponse = z.object({
  file: CrosswordFile,
  /** What Claude was unsure about. */
  notes: z.array(z.string()),
  costUsd: z.number().nullable(),
});
export type ParseCrosswordResponse = z.infer<typeof ParseCrosswordResponse>;
