import { describe, expect, it } from 'vitest';
import { mini } from '../tests/support/mini';
import {
  crosswordFromFile,
  crosswordToFile,
  withoutSolutions,
  type CrosswordFileData,
} from './file';

const clues = { across: [], down: [] };

describe('crosswordFromFile', () => {
  it('reads the grid: black squares, answers, and unknown answers', () => {
    const result = crosswordFromFile({ grid: ['A#', '.B'], clues });
    if (!result.ok) throw new Error(result.error);
    expect(result.crossword.width).toBe(2);
    expect(result.crossword.height).toBe(2);
    expect(result.crossword.squares).toEqual([
      { kind: 'open', solution: 'A', circled: false, shaded: false },
      { kind: 'block' },
      { kind: 'open', solution: null, circled: false, shaded: false },
      { kind: 'open', solution: 'B', circled: false, shaded: false },
    ]);
  });

  it('reads rebus, circled and shaded squares by cell number', () => {
    const result = crosswordFromFile({
      grid: ['H#', 'AB'],
      rebus: { 1: 'HEART' },
      circled: [3],
      shaded: [4],
      clues,
    });
    if (!result.ok) throw new Error(result.error);
    expect(result.crossword.squares[0]).toMatchObject({ solution: 'HEART' });
    expect(result.crossword.squares[2]).toMatchObject({ circled: true, shaded: false });
    expect(result.crossword.squares[3]).toMatchObject({ circled: false, shaded: true });
  });

  it('counts characters, not UTF-16 units', () => {
    const result = crosswordFromFile({ grid: ['𝔸B'], clues });
    expect(result.ok && result.crossword.width).toBe(2);
  });

  it.each<[string, CrosswordFileData, RegExp]>([
    ['an empty grid', { grid: [], clues }, /empty/],
    ['uneven rows', { grid: ['AB', 'C'], clues }, /Row 2 has 1 squares, but row 1 has 2/],
    ['an oversized grid', { grid: ['A'.repeat(41)], clues }, /most is 40×40/],
    ['a circle off the grid', { grid: ['AB'], circled: [3], clues }, /Square 3 is outside/],
    ['a rebus on a black square', { grid: ['A#'], rebus: { 2: 'XY' }, clues }, /black square/],
  ])('rejects %s', (_label, file, error) => {
    const result = crosswordFromFile(file);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(error);
  });
});

describe('crosswordToFile', () => {
  it('round-trips the sample', () => {
    const crossword = mini();
    const again = crosswordFromFile(crosswordToFile(crossword));
    expect(again).toEqual({ ok: true, crossword });
  });

  it('writes rebus, circled and shaded squares', () => {
    const result = crosswordFromFile({
      title: 'T',
      grid: ['H.', '#B'],
      rebus: { 1: 'HEART' },
      circled: [2],
      shaded: [4],
      clues,
    });
    if (!result.ok) throw new Error(result.error);
    expect(crosswordToFile(result.crossword)).toEqual({
      title: 'T',
      grid: ['H.', '#B'],
      rebus: { 1: 'HEART' },
      circled: [2],
      shaded: [4],
      clues,
    });
  });
});

describe('withoutSolutions', () => {
  it('drops every answer but keeps the grid and its markings', () => {
    const hidden = withoutSolutions(mini());
    expect(hidden.squares.every((s) => s.kind === 'block' || s.solution === null)).toBe(true);
    expect(hidden.squares.filter((s) => s.kind === 'block')).toHaveLength(6);
    expect(crosswordToFile(hidden).grid).toEqual(['...##', '....#', '.....', '#....', '##...']);
  });
});
