import { noMarks, type Entry, type SolveState } from '@gridicles/core';
import {
  buildPuzzleIndex,
  parseCompactGrid,
  puzzleFromCompact,
  type Puzzle,
} from '@gridicles/acrostic';
import { describe, expect, it } from 'vitest';
import sample from '../../../../../samples/puzzles/diplo-crostic-37.json';
import { sheetLayout, type SheetCell } from './sheetLayout';

//   1A 2B  #  3A
//   4B  #  5A
// Clue A = 3, 1, 5. Clue B = 4, 2.
function tinyPuzzle(): Puzzle {
  const grid = parseCompactGrid(4, ['1A 2B # 3A', '4B # 5A']);
  if (!grid.ok) throw new Error(grid.error);
  return {
    grid: grid.grid,
    clues: [
      { label: 'A', text: 'First clue', cells: [3, 1, 5] },
      { label: 'B', text: 'Second clue', cells: [4, 2] },
    ],
  };
}

const index = buildPuzzleIndex(tinyPuzzle());
const solve = { 1: 'X', 3: 'E or I' } as unknown as SolveState;

// Grid rows 0-1, a gap, letters grid rows 3-4. Clues from column 5, six columns
// wide (the minimum), so answer letters start at column 11.
const at = (rows: readonly (readonly (SheetCell | null)[])[], row: number, column: number) =>
  rows[row]?.[column];

describe('sheetLayout', () => {
  const { rows } = sheetLayout(index, solve, noMarks);

  it('makes every row the same width', () => {
    expect(rows).toHaveLength(5);
    for (const row of rows) expect(row).toHaveLength(14);
  });

  it('draws the labels grid with blocks, leaving the short last row empty', () => {
    expect(rows[0]?.slice(0, 4).map((cell) => cell?.text)).toEqual(['1A', '2B', '', '3A']);
    expect(at(rows, 0, 2)?.kind).toBe('block');
    expect(at(rows, 1, 0)).toMatchObject({ kind: 'label', text: '4B' });
    expect(at(rows, 1, 3)?.kind).toBe('empty');
  });

  it('draws the letters grid under it, each square copying its clue letter', () => {
    expect(at(rows, 3, 0)).toEqual({
      kind: 'letter',
      text: 'X',
      marked: false,
      copies: { row: 0, column: 12 },
    });
    expect(at(rows, 3, 1)).toMatchObject({ text: '', copies: { row: 2, column: 12 } });
    expect(at(rows, 3, 2)?.kind).toBe('block');
    // Multi-character entries stay whole.
    expect(at(rows, 3, 3)).toMatchObject({ text: 'E or I', copies: { row: 0, column: 11 } });
  });

  it('puts each clue to the right, merged over two rows, with letters and square numbers', () => {
    expect(at(rows, 0, 5)).toEqual({
      kind: 'clue',
      text: 'A. First clue',
      columnSpan: 6,
      rowSpan: 2,
    });
    expect(at(rows, 0, 6)).toBeNull();
    expect(at(rows, 1, 10)).toBeNull();
    expect(rows[0]?.slice(11).map((cell) => cell?.text)).toEqual(['E or I', 'X', '']);
    expect(rows[1]?.slice(11).map((cell) => cell?.text)).toEqual(['3', '1', '5']);
    expect(at(rows, 2, 5)?.text).toBe('B. Second clue');
    expect(rows[2]?.slice(11).map((cell) => cell?.text)).toEqual(['', '', '']);
    expect(at(rows, 2, 13)?.kind).toBe('empty');
  });

  it('keeps highlights in both grids and the clues', () => {
    const marked = sheetLayout(index, solve, new Set([5])).rows;
    expect(at(marked, 1, 2)).toMatchObject({ text: '5A', marked: true });
    expect(at(marked, 4, 2)).toMatchObject({ kind: 'letter', marked: true });
    expect(at(marked, 0, 13)).toMatchObject({ kind: 'answer', marked: true });
    expect(at(marked, 0, 11)).toMatchObject({ kind: 'answer', marked: false });
  });

  it('widens the clue column for long clues', () => {
    const long = buildPuzzleIndex({
      ...tinyPuzzle(),
      clues: [
        { label: 'A', text: 'x'.repeat(37), cells: [3, 1, 5] },
        { label: 'B', text: 'y', cells: [4, 2] },
      ],
    });
    // "A. " + 37 characters = 40, at 4 per column.
    expect(at(sheetLayout(long, {}, noMarks).rows, 0, 5)?.columnSpan).toBe(10);
  });

  it('links every letter square of the sample to the answer letter holding its value', () => {
    const converted = puzzleFromCompact(sample);
    if (!converted.ok) throw new Error(converted.error);
    const sampleIndex = buildPuzzleIndex(converted.puzzle);
    const filled = Object.fromEntries(
      sampleIndex.cells.map((cell) => [cell, `L${cell}`]),
    ) as Record<number, Entry>;
    const layout = sheetLayout(sampleIndex, filled, noMarks).rows;
    const letters = layout.flat().filter((cell) => cell?.kind === 'letter');
    expect(letters).toHaveLength(sampleIndex.cells.length);
    for (const cell of letters) {
      if (!cell?.copies) throw new Error('letter without a source');
      expect(at(layout, cell.copies.row, cell.copies.column)).toMatchObject({
        kind: 'answer',
        text: cell.text,
      });
    }
  });
});
