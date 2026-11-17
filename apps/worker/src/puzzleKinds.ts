import {
  buildPuzzleIndex,
  hasErrors,
  puzzleFromCompact,
  validatePuzzle,
} from '@gridicles/acrostic';
import type { CellNumber } from '@gridicles/core';
import {
  buildCrosswordIndex,
  crosswordFromFile,
  hasCrosswordErrors,
  validateCrossword,
} from '@gridicles/crossword';
import { puzzleKindOf, type PuzzleFile, type PuzzleKind } from '@gridicles/protocol';

/** What the server needs from a puzzle of any kind. */
export interface CheckedPuzzle {
  readonly kind: PuzzleKind;
  readonly title: string | null;
  /** The cell numbers `cell/set` and `cell/mark` may name. */
  readonly cells: ReadonlySet<CellNumber>;
}

export type PuzzleCheck =
  | { readonly ok: true; readonly puzzle: CheckedPuzzle }
  | {
      readonly ok: false;
      /** The file couldn't be read at all (400), or it has errors to fix (422). */
      readonly status: 400 | 422;
      readonly error: string;
      readonly issues?: readonly { readonly code: string; readonly message: string }[];
    };

/**
 * The one place the server looks inside a puzzle: reads and validates a file
 * of either kind, and reports what a room needs. Everything else (rooms,
 * edits, highlights) works on cell numbers alone.
 */
export function checkPuzzle(file: PuzzleFile): PuzzleCheck {
  const title = file.title ?? null;
  if (file.kind === 'crossword') {
    const converted = crosswordFromFile(file);
    if (!converted.ok)
      return { ok: false, status: 400, error: `Invalid crossword: ${converted.error}` };
    const index = buildCrosswordIndex(converted.crossword);
    const issues = validateCrossword(index);
    if (hasCrosswordErrors(issues)) return unusable(issues);
    return { ok: true, puzzle: { kind: 'crossword', title, cells: new Set(index.cells) } };
  }
  const converted = puzzleFromCompact(file);
  if (!converted.ok) return { ok: false, status: 400, error: `Invalid puzzle: ${converted.error}` };
  const issues = validatePuzzle(converted.puzzle);
  if (hasErrors(issues)) return unusable(issues);
  const index = buildPuzzleIndex(converted.puzzle);
  return { ok: true, puzzle: { kind: puzzleKindOf(file), title, cells: new Set(index.cells) } };
}

function unusable(
  issues: readonly { readonly severity: string; readonly code: string; readonly message: string }[],
): PuzzleCheck {
  return {
    ok: false,
    status: 422,
    error: 'The puzzle has errors. Fix them before creating a room.',
    issues: issues
      .filter((issue) => issue.severity === 'error')
      .map(({ code, message }) => ({ code, message })),
  };
}
