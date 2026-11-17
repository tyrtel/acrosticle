import type { CellNumber } from '@gridicles/core';
import { columnLabel, type CrosswordIndex, type Direction } from '@gridicles/crossword';

/**
 * The small label in a square's corner: its clue number, or in a
 * rows-and-columns puzzle the column letter along the top row and the row
 * number down the left (so "A1" in the corner square).
 */
export function squareLabel(index: CrosswordIndex, cell: CellNumber): string {
  if (index.puzzle.style !== 'rows-columns') return String(index.numberAt(cell) ?? '');
  const { row, column } = index.positionOf(cell);
  return `${row === 0 ? columnLabel(column) : ''}${column === 0 ? String(row + 1) : ''}`;
}

/** What a direction is called: Across / Down, or Rows / Columns. */
export function directionName(index: CrosswordIndex, direction: Direction, plural = false): string {
  if (index.puzzle.style === 'rows-columns') {
    const name = direction === 'across' ? 'Row' : 'Column';
    return plural ? `${name}s` : name;
  }
  return direction === 'across' ? 'Across' : 'Down';
}

/** A word's name: "14 Across", or "Row 3" / "Column B". */
export function wordName(
  index: CrosswordIndex,
  word: { readonly direction: Direction; readonly label: string },
): string {
  return index.puzzle.style === 'rows-columns'
    ? `${directionName(index, word.direction)} ${word.label}`
    : `${word.label} ${directionName(index, word.direction)}`;
}
