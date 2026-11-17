import type { CellNumber } from '@gridicles/core';
import type { Crossword, Direction } from './puzzle';
import { cellOf, columnLabel, gridIndexOf } from './puzzle';

/** A run of open squares across or down, with its number, label and clue. */
export interface Word {
  readonly direction: Direction;
  /** The printed number (standard), or the row / column position from 1 (rows and columns). */
  readonly number: number;
  /** How the word is named: its number, or "B" for column B of a rows-and-columns puzzle. */
  readonly label: string;
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
  /** The word with a number, if there is one. */
  wordNumbered(direction: Direction, number: number): Word | undefined;
  /** The number printed in a square, if a word starts there (none in rows-and-columns puzzles). */
  numberAt(cell: CellNumber): number | undefined;
  isOpen(cell: CellNumber): boolean;
  /** Whether a bar is drawn on this cell's right or bottom edge. */
  hasBar(cell: CellNumber, side: 'right' | 'bottom'): boolean;
  /** The cell at a row and column, or undefined off the grid. Black squares count as cells here. */
  cellAt(row: number, column: number): CellNumber | undefined;
  positionOf(cell: CellNumber): { readonly row: number; readonly column: number };
}

/**
 * Finds the grid's words. In a standard crossword a square gets the next
 * number if a word of two or more squares starts there, across or down, with
 * words ended by black squares, bars or the edge. In a rows-and-columns
 * puzzle every row and every column is one word, and nothing is numbered.
 */
export function buildCrosswordIndex(puzzle: Crossword): CrosswordIndex {
  const { width, height, squares } = puzzle;
  const at = (row: number, column: number) => row * width + column;
  const open = (row: number, column: number) =>
    row >= 0 &&
    row < height &&
    column >= 0 &&
    column < width &&
    squares[at(row, column)]?.kind === 'open';
  const barsRight = new Set(puzzle.bars?.right ?? []);
  const barsBottom = new Set(puzzle.bars?.bottom ?? []);
  /** Whether a word continues from this square to the next one across / down. */
  const joinsRight = (row: number, column: number) =>
    open(row, column) && open(row, column + 1) && !barsRight.has(cellOf(at(row, column)));
  const joinsDown = (row: number, column: number) =>
    open(row, column) && open(row + 1, column) && !barsBottom.has(cellOf(at(row, column)));

  const cells: CellNumber[] = [];
  for (let i = 0; i < squares.length; i++) if (squares[i]?.kind === 'open') cells.push(cellOf(i));

  const numbers = new Map<CellNumber, number>();
  const words: Record<Direction, Word[]> = { across: [], down: [] };
  const clueText: Record<Direction, Map<number, string>> = {
    across: new Map(puzzle.clues.across.map((clue) => [clue.number, clue.text])),
    down: new Map(puzzle.clues.down.map((clue) => [clue.number, clue.text])),
  };
  const word = (direction: Direction, number: number, label: string, run: CellNumber[]): Word => ({
    direction,
    number,
    label,
    cells: run,
    clue: clueText[direction].get(number) ?? null,
  });

  if (puzzle.style === 'rows-columns') {
    for (let row = 0; row < height; row++) {
      const run = range(width)
        .filter((c) => open(row, c))
        .map((c) => cellOf(at(row, c)));
      if (run.length > 0) words.across.push(word('across', row + 1, String(row + 1), run));
    }
    for (let column = 0; column < width; column++) {
      const run = range(height)
        .filter((r) => open(r, column))
        .map((r) => cellOf(at(r, column)));
      if (run.length > 0) words.down.push(word('down', column + 1, columnLabel(column), run));
    }
  } else {
    let next = 1;
    for (let row = 0; row < height; row++) {
      for (let column = 0; column < width; column++) {
        const startsAcross = !joinsRight(row, column - 1) && joinsRight(row, column);
        const startsDown = !joinsDown(row - 1, column) && joinsDown(row, column);
        if (!startsAcross && !startsDown) continue;
        const number = next++;
        numbers.set(cellOf(at(row, column)), number);
        if (startsAcross) {
          const run = [cellOf(at(row, column))];
          for (let c = column; joinsRight(row, c); c++) run.push(cellOf(at(row, c + 1)));
          words.across.push(word('across', number, String(number), run));
        }
        if (startsDown) {
          const run = [cellOf(at(row, column))];
          for (let r = row; joinsDown(r, column); r++) run.push(cellOf(at(r + 1, column)));
          words.down.push(word('down', number, String(number), run));
        }
      }
    }
  }

  const wordByCell: Record<Direction, Map<CellNumber, Word>> = {
    across: new Map(),
    down: new Map(),
  };
  const byNumber: Record<Direction, Map<number, Word>> = { across: new Map(), down: new Map() };
  for (const direction of ['across', 'down'] as const) {
    for (const w of words[direction]) {
      byNumber[direction].set(w.number, w);
      for (const member of w.cells) wordByCell[direction].set(member, w);
    }
  }

  return {
    puzzle,
    cells,
    words: (direction) => words[direction],
    wordOf: (cell, direction) => wordByCell[direction].get(cell),
    wordNumbered: (direction, number) => byNumber[direction].get(number),
    numberAt: (cell) => numbers.get(cell),
    isOpen: (cell) => squares[gridIndexOf(cell)]?.kind === 'open',
    hasBar: (cell, side) => (side === 'right' ? barsRight : barsBottom).has(cell),
    cellAt: (row, column) =>
      row >= 0 && row < height && column >= 0 && column < width
        ? cellOf(at(row, column))
        : undefined,
    positionOf: (cell) => {
      const i = gridIndexOf(cell);
      return { row: Math.floor(i / width), column: i % width };
    },
  };
}

function range(n: number): number[] {
  return Array.from({ length: n }, (_, i) => i);
}
