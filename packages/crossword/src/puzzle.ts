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
/**
 * How words are laid out:
 * - `standard`: numbered words, ended by black squares, bars or the grid's edge.
 * - `rows-columns`: no word breaks marked. Each whole row is an "across" clue (labelled 1, 2, …)
 *   and each whole column a "down" clue (labelled A, B, …), each holding several clues in order.
 */
export type CrosswordStyle = 'standard' | 'rows-columns';

/** Thick lines between squares that end words, as in barred (cryptic) grids. */
export interface CrosswordBars {
  /** Cells with a bar on their right edge. */
  readonly right: readonly CellNumber[];
  /** Cells with a bar on their bottom edge. */
  readonly bottom: readonly CellNumber[];
}

export interface Crossword {
  readonly title?: string;
  readonly author?: string;
  readonly copyright?: string;
  /** Anything printed with the puzzle: instructions for a themed or variant puzzle, a note. */
  readonly notes?: string;
  /** Standard unless set. */
  readonly style?: CrosswordStyle;
  readonly bars?: CrosswordBars;
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

/** A column's label in a rows-and-columns puzzle: A, B, … Z, AA, AB, … */
export function columnLabel(index: number): string {
  let label = '';
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    label = String.fromCharCode(65 + ((n - 1) % 26)) + label;
  }
  return label;
}
