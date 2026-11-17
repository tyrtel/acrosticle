import { noMarks, type SolveState } from '@gridicles/core';
import { buildCrosswordIndex, crosswordFromFile } from '@gridicles/crossword';
import { describe, expect, it } from 'vitest';
import mini from '../../../../../samples/puzzles/gridicles-mini-1.json';
import { crosswordSheetLayout } from './crosswordSheetLayout';
import type { SheetCell } from './sheetLayout';

function miniIndex(extra: Partial<typeof mini> = {}) {
  const result = crosswordFromFile({ ...mini, ...extra });
  if (!result.ok) throw new Error(result.error);
  return buildCrosswordIndex(result.crossword);
}

const solve = { 1: 'G', 13: 'HEART' } as unknown as SolveState;
const at = (rows: readonly (readonly (SheetCell | null)[])[], row: number, column: number) =>
  rows[row]?.[column];

// Numbers grid rows 0-4, three blank rows, letters grid rows 8-12. Clues from column 6: "Across" on row
// 0, its five clues on rows 1-5, "Down" on row 6, its clues on rows 7-11. The longest clue,
// "1. Laughing ___ (dentist's aid)", is 31 characters: 8 columns, so answers start at column 14.
describe('crosswordSheetLayout', () => {
  const { rows } = crosswordSheetLayout(miniIndex(), solve, new Set([2]));

  it('makes every row the same width, tall enough for grids or clues', () => {
    expect(rows).toHaveLength(13);
    for (const row of rows) expect(row).toHaveLength(19);
  });

  it('draws the numbers grid and the letters grid, which holds the values', () => {
    expect(rows[0]?.slice(0, 5).map((cell) => cell?.text)).toEqual(['1', '2', '3', '', '']);
    expect(at(rows, 0, 3)?.kind).toBe('block');
    expect(at(rows, 1, 1)).toMatchObject({ kind: 'label', text: '' });
    expect(at(rows, 8, 0)).toMatchObject({ kind: 'letter', text: 'G' });
    expect(at(rows, 10, 2)).toMatchObject({ kind: 'letter', text: 'HEART' });
    expect(at(rows, 8, 0)?.copies).toBeUndefined();
  });

  it('keeps highlights in both grids and the answers', () => {
    expect(at(rows, 0, 1)).toMatchObject({ marked: true });
    expect(at(rows, 8, 1)).toMatchObject({ marked: true });
    expect(at(rows, 1, 15)).toMatchObject({ kind: 'answer', marked: true }); // 1 Across, 2nd square
  });

  it('leaves three blank rows between the grids', () => {
    for (const row of [5, 6, 7]) {
      expect(rows[row]?.slice(0, 5).every((cell) => cell?.kind === 'empty')).toBe(true);
    }
  });

  it('lists Across then Down, each clue followed by answers that copy the letters grid', () => {
    expect(at(rows, 0, 6)).toEqual({ kind: 'heading', text: 'Across' });
    expect(at(rows, 1, 6)).toEqual({
      kind: 'clue',
      text: '1. Fuel at the pump',
      columnSpan: 8,
    });
    expect(at(rows, 1, 7)).toBeNull();
    expect(at(rows, 1, 14)).toEqual({
      kind: 'answer',
      text: 'G',
      marked: false,
      copies: { row: 8, column: 0 },
    });
    expect(at(rows, 6, 6)).toEqual({ kind: 'heading', text: 'Down' });
    // 3 Down runs down column 2: its third square is the HEART rebus.
    expect(at(rows, 9, 16)).toMatchObject({ text: 'HEART', copies: { row: 10, column: 2 } });
  });

  it('marks circled and shaded squares, and copes with missing clues', () => {
    const marked = crosswordSheetLayout(
      miniIndex({ circled: [1], shaded: [2], clues: { across: [], down: [] } } as never),
      {},
      noMarks,
    ).rows;
    expect(at(marked, 0, 0)).toMatchObject({ circled: true, shaded: false });
    expect(at(marked, 8, 1)).toMatchObject({ circled: false, shaded: true });
    expect(at(marked, 1, 6)?.text).toBe('1. ');
  });
});
