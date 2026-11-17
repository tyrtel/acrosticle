import type { CellNumber } from '@gridicles/core';
import type { Crossword, Direction } from './puzzle';
import { cellOf, gridIndexOf } from './puzzle';

/** A run of open squares across or down, with its printed number and clue. */
export interface Word {
  readonly direction: Direction;
  readonly number: number;
  readonly cells: readonly CellNumber[];
  /** The clue text, or null if the puzzle has no clue for this word. */
  readonly clue: string | null;
}

/** Fast lookups over a crossword, built once and shared by the grid, the clue lists and navigation. */
export interface CrosswordIndex {
  readonly puzzle: Crossword;
  /** Open squares in reading order. */
  readonly cells: readonly CellNumber[];
  /** Words in clue order: by number. */
  words(direction: Direction): readonly Word[];
  /** The word through a cell in a direction, if there is one (a square can be in only one). */
  wordOf(cell: CellNumber, direction: Direction): Word | undefined;
  /** The word with a printed number, if there is one. */
  wordNumbered(direction: Direction, number: number): Word | undefined;
  /** The number printed in a square, if a word starts there. */
  numberAt(cell: CellNumber): number | undefined;
  isOpen(cell: CellNumber): boolean;
  /** The cell at a row and column, or undefined off the grid. Black squares count as cells here. */
  cellAt(row: number, column: number): CellNumber | undefined;
  positionOf(cell: CellNumber): { readonly row: number; readonly column: number };
}

/**
 * Numbers the grid and finds its words, the usual way: a square gets the next
 * number if a word of two or more squares starts there, across or down.
 */
export function buildCrosswordIndex(puzzle: Crossword): CrosswordIndex {
  const { width, height, squares } = puzzle;
  const open = (row: number, column: number) =>
    row >= 0 &&
    row < height &&
    column >= 0 &&
    column < width &&
    squares[row * width + column]?.kind === 'open';

  const cells: CellNumber[] = [];
  const numbers = new Map<CellNumber, number>();
  const words: Record<Direction, Word[]> = { across: [], down: [] };
  const wordByCell: Record<Direction, Map<CellNumber, Word>> = {
    across: new Map(),
    down: new Map(),
  };
  const clueText: Record<Direction, Map<number, string>> = {
    across: new Map(puzzle.clues.across.map((clue) => [clue.number, clue.text])),
    down: new Map(puzzle.clues.down.map((clue) => [clue.number, clue.text])),
  };

  let next = 1;
  for (let row = 0; row < height; row++) {
    for (let column = 0; column < width; column++) {
      if (!open(row, column)) continue;
      const cell = cellOf(row * width + column);
      cells.push(cell);
      const startsAcross = !open(row, column - 1) && open(row, column + 1);
      const startsDown = !open(row - 1, column) && open(row + 1, column);
      if (!startsAcross && !startsDown) continue;
      const number = next++;
      numbers.set(cell, number);
      const addWord = (direction: Direction, dRow: number, dColumn: number) => {
        const run: CellNumber[] = [];
        for (let r = row, c = column; open(r, c); r += dRow, c += dColumn)
          run.push(cellOf(r * width + c));
        const word: Word = {
          direction,
          number,
          cells: run,
          clue: clueText[direction].get(number) ?? null,
        };
        words[direction].push(word);
        for (const member of run) wordByCell[direction].set(member, word);
      };
      if (startsAcross) addWord('across', 0, 1);
      if (startsDown) addWord('down', 1, 0);
    }
  }

  const byNumber: Record<Direction, Map<number, Word>> = {
    across: new Map(words.across.map((word) => [word.number, word])),
    down: new Map(words.down.map((word) => [word.number, word])),
  };

  return {
    puzzle,
    cells,
    words: (direction) => words[direction],
    wordOf: (cell, direction) => wordByCell[direction].get(cell),
    wordNumbered: (direction, number) => byNumber[direction].get(number),
    numberAt: (cell) => numbers.get(cell),
    isOpen: (cell) => squares[gridIndexOf(cell)]?.kind === 'open',
    cellAt: (row, column) =>
      row >= 0 && row < height && column >= 0 && column < width
        ? cellOf(row * width + column)
        : undefined,
    positionOf: (cell) => {
      const i = gridIndexOf(cell);
      return { row: Math.floor(i / width), column: i % width };
    },
  };
}
