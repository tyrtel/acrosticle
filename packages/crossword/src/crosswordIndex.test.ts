import { describe, expect, it } from 'vitest';
import { mini, miniIndex } from '../tests/support/mini';
import { buildCrosswordIndex } from './crosswordIndex';

describe('buildCrosswordIndex', () => {
  const index = miniIndex();

  it('numbers squares where words start', () => {
    const numbered = index.cells.flatMap((cell) => {
      const number = index.numberAt(cell);
      return number === undefined ? [] : [[cell, number]];
    });
    expect(numbered).toEqual([
      [1, 1],
      [2, 2],
      [3, 3],
      [6, 4],
      [9, 5],
      [11, 6],
      [15, 7],
      [17, 8],
      [23, 9],
    ]);
  });

  it('finds the words in each direction, with their clues', () => {
    expect(index.words('across').map((w) => [w.number, w.cells])).toEqual([
      [1, [1, 2, 3]],
      [4, [6, 7, 8, 9]],
      [6, [11, 12, 13, 14, 15]],
      [8, [17, 18, 19, 20]],
      [9, [23, 24, 25]],
    ]);
    expect(index.words('down').map((w) => [w.number, w.cells])).toEqual([
      [1, [1, 6, 11]],
      [2, [2, 7, 12, 17]],
      [3, [3, 8, 13, 18, 23]],
      [5, [9, 14, 19, 24]],
      [7, [15, 20, 25]],
    ]);
    expect(index.wordNumbered('across', 6)?.clue).toBe('Roofing stone');
    expect(index.wordNumbered('down', 6)).toBeUndefined();
  });

  it('finds the word through a square in each direction', () => {
    expect(index.wordOf(13, 'across')?.number).toBe(6);
    expect(index.wordOf(13, 'down')?.number).toBe(3);
    expect(index.wordOf(4, 'across')).toBeUndefined();
  });

  it('lists open squares and maps cells to positions', () => {
    expect(index.cells).toHaveLength(19);
    expect(index.isOpen(4)).toBe(false);
    expect(index.isOpen(13)).toBe(true);
    expect(index.positionOf(14)).toEqual({ row: 2, column: 3 });
    expect(index.cellAt(2, 3)).toBe(14);
    expect(index.cellAt(5, 0)).toBeUndefined();
    expect(index.cellAt(0, -1)).toBeUndefined();
  });

  it('gives a word with no clue a null clue', () => {
    const bare = buildCrosswordIndex({ ...mini(), clues: { across: [], down: [] } });
    expect(bare.wordNumbered('across', 1)?.clue).toBeNull();
  });
});
