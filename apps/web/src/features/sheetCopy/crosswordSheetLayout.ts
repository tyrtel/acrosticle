import { getCell, type Marks, type SolveState } from '@gridicles/core';
import { cellOf, type CrosswordIndex, type Word } from '@gridicles/crossword';
import type { SheetCell, SheetLayout, SheetPosition } from './sheetLayout';

/** Roughly how many characters of clue text fit in one narrow column. */
const CHARS_PER_COLUMN = 4;
const MIN_CLUE_COLUMNS = 6;
const GRID_GAP_ROWS = 3;
const EMPTY: SheetCell = { kind: 'empty', text: '' };

/**
 * Lays a crossword out for a spreadsheet, one narrow column per square: the
 * numbers grid, the letters grid under it, and the Across and Down clues to
 * the right, each followed by its answer squares.
 *
 * In a crossword each square is shared by two clues, so the letters grid holds
 * the values and every clue's answer squares refer to it by formula: solving
 * in the grid fills the clues. Highlights, circles and shading are kept;
 * cursors and the selection are not.
 */
export function crosswordSheetLayout(
  index: CrosswordIndex,
  solve: SolveState,
  marks: Marks,
): SheetLayout {
  const { width, height, squares } = index.puzzle;
  // Blank rows between the two grids, to set them apart.
  const lettersTop = height + GRID_GAP_ROWS;
  const clueLeft = width + 1;
  const words = [...index.words('across'), ...index.words('down')];
  const clueText = (word: Word) => `${word.number}. ${word.clue ?? ''}`;
  const longestClue = Math.max(0, ...words.map((word) => clueText(word).length));
  const clueColumns = Math.max(MIN_CLUE_COLUMNS, Math.ceil(longestClue / CHARS_PER_COLUMN));
  const answerLeft = clueLeft + clueColumns;
  const longestAnswer = Math.max(0, ...words.map((word) => word.cells.length));
  // A heading row for each direction, then a row per clue.
  const clueRows = 2 + words.length;

  const rows: (SheetCell | null)[][] = Array.from(
    { length: Math.max(lettersTop + height, clueRows) },
    () => Array.from({ length: answerLeft + longestAnswer }, () => EMPTY),
  );
  const put = (row: number, column: number, cell: SheetCell | null) => {
    const target = rows[row];
    if (target) target[column] = cell;
  };

  const letterAt = new Map<number, SheetPosition>();
  squares.forEach((square, i) => {
    const row = Math.floor(i / width);
    const column = i % width;
    if (square.kind === 'block') {
      put(row, column, { kind: 'block', text: '' });
      put(lettersTop + row, column, { kind: 'block', text: '' });
      return;
    }
    const cell = cellOf(i);
    const look = { marked: marks.has(cell), circled: square.circled, shaded: square.shaded };
    put(row, column, { kind: 'label', text: String(index.numberAt(cell) ?? ''), ...look });
    put(lettersTop + row, column, { kind: 'letter', text: getCell(solve, cell) ?? '', ...look });
    letterAt.set(cell, { row: lettersTop + row, column });
  });

  let row = 0;
  for (const direction of ['across', 'down'] as const) {
    put(row++, clueLeft, { kind: 'heading', text: direction === 'across' ? 'Across' : 'Down' });
    for (const word of index.words(direction)) {
      put(row, clueLeft, { kind: 'clue', text: clueText(word), columnSpan: clueColumns });
      for (let c = clueLeft + 1; c < answerLeft; c++) put(row, c, null);
      word.cells.forEach((cell, j) => {
        const copies = letterAt.get(cell);
        put(row, answerLeft + j, {
          kind: 'answer',
          text: getCell(solve, cell) ?? '',
          marked: marks.has(cell),
          ...(copies && { copies }),
        });
      });
      row++;
    }
  }

  return { rows };
}
