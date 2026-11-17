import { puzzleFromCompact, type Puzzle } from '@gridicles/acrostic';
import { crosswordFromFile, type Crossword } from '@gridicles/crossword';
import type { ParseResult, PuzzleFile } from '@gridicles/protocol';

/** A room's puzzle, of either kind, ready for its solver. */
export type RoomPuzzle =
  | { readonly kind: 'acrostic'; readonly puzzle: Puzzle }
  | { readonly kind: 'crossword'; readonly puzzle: Crossword };

/** Reads the puzzle a room sends in its snapshot. */
export function readRoomPuzzle(file: PuzzleFile): ParseResult<RoomPuzzle> {
  if (file.kind === 'crossword') {
    const result = crosswordFromFile(file);
    return result.ok
      ? { ok: true, value: { kind: 'crossword', puzzle: result.crossword } }
      : { ok: false, error: result.error };
  }
  const result = puzzleFromCompact(file);
  return result.ok
    ? { ok: true, value: { kind: 'acrostic', puzzle: result.puzzle } }
    : { ok: false, error: result.error };
}

/** The puzzle's title, whatever its kind. */
export function roomPuzzleTitle(room: RoomPuzzle): string | undefined {
  return room.puzzle.title;
}
