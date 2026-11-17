import type { Grid } from '@gridicles/acrostic';

/**
 * A square's printed shape, for any puzzle type: an answer square with its small label (an
 * acrostic's "12V", a crossword's clue number or nothing), a black square, or punctuation.
 */
export type GridShape =
  | { readonly kind: 'letter'; readonly label: string }
  | { readonly kind: 'block' }
  | { readonly kind: 'punctuation'; readonly char: string };

/** The grid to draw: its width and its squares in reading order (the last row may be short). */
export interface GridLayout {
  readonly columns: number;
  readonly squares: readonly GridShape[];
}

/** An acrostic grid as shapes: each letter square labelled with its number and clue ("12V"). */
export function acrosticLayout(grid: Grid): GridLayout {
  return {
    columns: grid.columns,
    squares: grid.squares.map((square) =>
      square.kind === 'letter'
        ? { kind: 'letter', label: `${square.number}${square.clue}` }
        : square,
    ),
  };
}
