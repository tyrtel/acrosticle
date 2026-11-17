import { getCell, type Marks, type SolveState } from '@gridicles/core';
import { type PuzzleIndex } from '@gridicles/acrostic';

/** What a spreadsheet cell holds, which decides how it's drawn. */
export type SheetCellKind =
  | 'empty'
  /** Labels grid: a square's number and clue, e.g. "21A". */
  | 'label'
  /** Letters grid: the square's letter, copied from its clue blank by a formula. */
  | 'letter'
  | 'block'
  | 'punctuation'
  /** "A. Daughter to Brabantio", merged across columns and both of the clue's rows. */
  | 'clue'
  /** A clue's answer letter: where letters live in the sheet. */
  | 'answer'
  /** The square number under an answer letter. */
  | 'number'
  /** A section heading, e.g. a crossword's "Across". */
  | 'heading';

/** A spot in the sheet, counted from 0 (row 0, column 0 is A1). */
export interface SheetPosition {
  readonly row: number;
  readonly column: number;
}

export interface SheetCell {
  readonly kind: SheetCellKind;
  readonly text: string;
  /** Someone highlighted the square (green). */
  readonly marked?: boolean;
  /** Printed with a circle (crosswords): drawn with a heavier border, since sheets have no circles. */
  readonly circled?: boolean;
  /** Printed shaded (crosswords). */
  readonly shaded?: boolean;
  /** Letters-grid squares show this cell's value (a formula), so solving in the sheet fills both. */
  readonly copies?: SheetPosition;
  readonly columnSpan?: number;
  readonly rowSpan?: number;
}

export interface SheetLayout {
  /** Every row has the same length. Null means covered by a merged cell. */
  readonly rows: readonly (readonly (SheetCell | null)[])[];
}

/** Roughly how many characters of clue text fit in one narrow column. */
const CHARS_PER_COLUMN = 4;
const MIN_CLUE_COLUMNS = 6;

const EMPTY: SheetCell = { kind: 'empty', text: '' };

/**
 * Lays the puzzle out for a spreadsheet, one character-sized column per
 * square: the labels grid, the letters grid under it, and the clues to the
 * right, each with its answer letters and their square numbers underneath.
 *
 * Answer letters hold the values; the letters grid refers to them, the way the
 * app keeps one letter per square. Highlights are kept; cursors and the current
 * selection are not.
 */
export function sheetLayout(index: PuzzleIndex, solve: SolveState, marks: Marks): SheetLayout {
  const { grid } = index.puzzle;
  const gridRows = Math.ceil(grid.squares.length / grid.columns);
  const lettersTop = gridRows + 1;
  const clueLeft = grid.columns + 1;
  const longestClue = Math.max(0, ...index.clues.map((clue) => clueText(clue).length));
  const clueColumns = Math.max(MIN_CLUE_COLUMNS, Math.ceil(longestClue / CHARS_PER_COLUMN));
  const answerLeft = clueLeft + clueColumns;
  const longestAnswer = Math.max(0, ...index.clues.map((clue) => clue.cells.length));

  const height = Math.max(lettersTop + gridRows, index.clues.length * 2);
  const width = answerLeft + longestAnswer;
  const rows: (SheetCell | null)[][] = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => EMPTY),
  );
  const put = (row: number, column: number, cell: SheetCell | null) => {
    const target = rows[row];
    if (target) target[column] = cell;
  };

  // Clues first, so the letters grid knows where each answer letter is.
  const answerAt = new Map<number, SheetPosition>();
  index.clues.forEach((clue, i) => {
    const row = i * 2;
    put(row, clueLeft, { kind: 'clue', text: clueText(clue), columnSpan: clueColumns, rowSpan: 2 });
    for (let r = row; r < row + 2; r++) {
      for (let c = clueLeft; c < answerLeft; c++) {
        if (r !== row || c !== clueLeft) put(r, c, null);
      }
    }
    clue.cells.forEach((cell, j) => {
      const column = answerLeft + j;
      const marked = marks.has(cell);
      put(row, column, { kind: 'answer', text: getCell(solve, cell) ?? '', marked });
      put(row + 1, column, { kind: 'number', text: String(cell) });
      answerAt.set(cell, { row, column });
    });
  });

  grid.squares.forEach((square, i) => {
    const row = Math.floor(i / grid.columns);
    const column = i % grid.columns;
    switch (square.kind) {
      case 'block':
        put(row, column, { kind: 'block', text: '' });
        put(lettersTop + row, column, { kind: 'block', text: '' });
        return;
      case 'punctuation':
        put(row, column, { kind: 'punctuation', text: square.char });
        put(lettersTop + row, column, { kind: 'punctuation', text: square.char });
        return;
      case 'letter': {
        const marked = marks.has(square.number);
        const label = `${square.number}${square.clue}`;
        put(row, column, { kind: 'label', text: label, marked });
        const copies = answerAt.get(square.number);
        put(lettersTop + row, column, {
          kind: 'letter',
          text: getCell(solve, square.number) ?? '',
          marked,
          ...(copies && { copies }),
        });
      }
    }
  });

  return { rows };
}

function clueText(clue: { label: string; text: string }): string {
  return `${clue.label}. ${clue.text}`;
}
