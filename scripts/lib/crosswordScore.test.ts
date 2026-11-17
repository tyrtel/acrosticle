import { describe, expect, it } from 'vitest';
import mini from '../../samples/puzzles/gridicles-mini-1.json';
import { overlap, scoreCrossword, type CrosswordTruth } from './crosswordScore';

const truth: CrosswordTruth = {
  style: 'standard',
  width: 5,
  height: 5,
  grid: mini.grid.map((row) => row.replace(/[^#]/g, '.')),
  across: [1, 4, 6, 8, 9],
  down: [1, 2, 3, 5, 7],
};

describe('scoreCrossword', () => {
  it('scores a perfect read as perfect', () => {
    expect(scoreCrossword(mini, truth)).toEqual({
      sizeRight: true,
      styleRight: true,
      squares: 1,
      numbering: 1,
      clues: 1,
    });
  });

  it('counts wrong squares, and the numbering they spoil', () => {
    // Opening square 4 joins it to 1 Across and starts a new down word there.
    const misread = { ...mini, grid: ['GAS.#', ...mini.grid.slice(1)] };
    const score = scoreCrossword(misread, truth);
    expect(score.squares).toBeCloseTo(24 / 25);
    expect(score.numbering).toBeLessThan(1);
  });

  it('notices a wrong size or style, and missing clues', () => {
    const score = scoreCrossword(
      { ...mini, grid: ['GAS##'], style: 'rows-columns', clues: { across: [], down: [] } },
      truth,
    );
    expect(score).toMatchObject({ sizeRight: false, styleRight: false, squares: null, clues: 0 });
  });

  it('skips numbering and clues for a grid-only photo', () => {
    expect(scoreCrossword(mini, { ...truth, across: [], down: [] })).toMatchObject({
      numbering: null,
      clues: null,
    });
  });
});

describe('overlap', () => {
  it('is shared over all', () => {
    expect(overlap([1, 2, 3], [2, 3, 4])).toBe(0.5);
    expect(overlap([], [])).toBe(1);
  });
});
