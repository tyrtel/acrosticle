import type { CellNumber } from '@gridicles/core';
import type { Direction } from '@gridicles/crossword';

/** DOM ids for the cursor target and the clue list rows, used for scrolling. */
export const crosswordSquareId = (cell: CellNumber) => `crossword-square-${cell}`;
export const crosswordClueId = (direction: Direction, number: number) =>
  `crossword-clue-${direction}-${number}`;
