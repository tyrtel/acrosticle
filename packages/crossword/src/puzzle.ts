import type { CellNumber } from '@gridicles/core';

/** Across or down: the way a word runs, and the way typing moves. */
export type Direction = 'across' | 'down';

export type CrosswordSquare =
  | { readonly kind: 'block' }
  | {
      readonly kind: 'open';
      /** The answer, if the puzzle came with one (several characters for a rebus square). */
      readonly solution: string | null;
      readonly circled: boolean;
      readonly shaded: boolean;
    };

/** A clue as printed: its number and text. Which squares it covers comes from the grid. */
export interface CrosswordClue {
  readonly number: number;
  readonly text: string;
}

/** A crossword. Immutable once a room is created. */
export interface Crossword {
  readonly title?: string;
  readonly author?: string;
  readonly copyright?: string;
  readonly notes?: string;
  readonly width: number;
  readonly height: number;
  /** Squares in reading order (row by row). Square i is cell i + 1 (see `cellOf`). */
  readonly squares: readonly CrosswordSquare[];
  readonly clues: {
    readonly across: readonly CrosswordClue[];
    readonly down: readonly CrosswordClue[];
  };
}

/**
 * A crossword square's cell number: its position, counted from 1 in reading
 * order. Crosswords print numbers only where words start, so the position is
 * the square's identity in the solve state; printed numbers are display data.
 */
export function cellOf(gridIndex: number): CellNumber {
  return gridIndex + 1;
}

/** The reading-order position of a cell (the inverse of `cellOf`). */
export function gridIndexOf(cell: CellNumber): number {
  return cell - 1;
}

/** The grid is at most this many squares across or down. */
export const MAX_CROSSWORD_SIZE = 40;
