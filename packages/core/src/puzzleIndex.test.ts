import { describe, expect, it } from 'vitest';
import { diploCrostic37, makePuzzle, tinyPuzzle } from '../tests/support/puzzles';
import { buildPuzzleIndex } from './puzzleIndex';

describe('buildPuzzleIndex', () => {
  //   1A 2B  #  3A
  //   4B  #  5A
  const index = buildPuzzleIndex(tinyPuzzle());

  it('lists letter cells in reading order', () => {
    expect(index.cells).toEqual([1, 2, 3, 4, 5]);
  });

  it('maps cells to grid positions and back', () => {
    expect(index.gridIndexOf(3)).toBe(3);
    expect(index.gridIndexOf(5)).toBe(6);
    expect(index.squareAt(2)).toEqual({ kind: 'block' });
    expect(index.squareAt(99)).toBeUndefined();
    expect(index.readingPositionOf(4)).toBe(3);
  });

  it('maps cells to their clue and position in the answer', () => {
    expect(index.clueRefOf(3)).toEqual({ label: 'A', position: 0 });
    expect(index.clueRefOf(5)).toEqual({ label: 'A', position: 2 });
    expect(index.clueRefOf(2)).toEqual({ label: 'B', position: 1 });
  });

  it('looks up clues by label', () => {
    expect(index.clue('B').cells).toEqual([4, 2]);
    expect(index.cluePositionOf('B')).toBe(1);
  });

  it('groups cells into grid words split by black squares, across row ends', () => {
    expect(index.wordOf(1)).toEqual([1, 2]);
    expect(index.wordOf(3)).toEqual([3, 4]);
    expect(index.wordOf(5)).toEqual([5]);
  });

  it('does not split words at punctuation', () => {
    const withApostrophe = buildPuzzleIndex(makePuzzle(4, ["1A ' 2A #", '3A'], { A: [1, 2, 3] }));
    expect(withApostrophe.wordOf(1)).toEqual([1, 2]);
    expect(withApostrophe.wordOf(3)).toEqual([3]);
  });

  it('throws on unknown cells and clues', () => {
    expect(() => index.gridIndexOf(6)).toThrow(RangeError);
    expect(() => index.clueRefOf(0)).toThrow('Unknown cell: 0');
    expect(() => index.clue('Z')).toThrow('Unknown clue: Z');
  });

  it('refuses to index a puzzle with validation errors', () => {
    expect(() => buildPuzzleIndex(diploCrostic37({ asPrinted: true }))).toThrow(
      /validation errors/,
    );
  });

  it('indexes the full sample puzzle', () => {
    const sample = buildPuzzleIndex(diploCrostic37());
    expect(sample.cells).toHaveLength(232);
    expect(sample.clues).toHaveLength(26);
    // Row 1 of the printed grid: "1O 2E 3P 4D 5A 6J 7I 8M #".
    expect(sample.wordOf(1)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(sample.clueRefOf(5)).toEqual({ label: 'A', position: 1 });
  });
});
