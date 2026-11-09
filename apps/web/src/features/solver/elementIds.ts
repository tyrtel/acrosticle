import type { CellNumber } from '@acrosticle/core';

/** DOM ids for the cursor targets, used for aria-activedescendant and scrolling. */
export const gridSquareId = (cell: CellNumber) => `grid-square-${cell}`;
export const clueBlankId = (cell: CellNumber) => `clue-blank-${cell}`;
