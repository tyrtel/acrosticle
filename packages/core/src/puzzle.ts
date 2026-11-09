/**
 * The printed number of a letter square in the quote grid (1..N).
 *
 * Every clue-answer blank maps to exactly one grid square, so the cell number
 * is the single source of truth: the grid view and the clue view are both
 * projections of one solve state keyed by cell number.
 */
export type CellNumber = number;

/** A clue's label: "A", "B", ... "Z", "AA", "BB", ... (see `clueLabel`). */
export type ClueLabel = string;

export type GridSquare =
  | { readonly kind: 'letter'; readonly number: CellNumber; readonly clue: ClueLabel }
  | { readonly kind: 'block' }
  | { readonly kind: 'punctuation'; readonly char: string };

export interface Grid {
  readonly columns: number;
  /** Squares in reading order (row by row, left to right). The last row may be short. */
  readonly squares: readonly GridSquare[];
}

export interface Clue {
  readonly label: ClueLabel;
  readonly text: string;
  /** The answer blanks, in answer order, as grid cell numbers. */
  readonly cells: readonly CellNumber[];
}

/** An acrostic puzzle definition. Immutable once a room is created. */
export interface Puzzle {
  readonly title?: string;
  readonly constructedBy?: string;
  readonly source?: string;
  readonly grid: Grid;
  /** Clues in label order. */
  readonly clues: readonly Clue[];
}
