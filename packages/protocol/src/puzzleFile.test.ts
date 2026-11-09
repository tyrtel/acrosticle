import { validatePuzzle } from '@acrosticle/core';
import { describe, expect, it } from 'vitest';
import sample from '../../../samples/puzzles/diplo-crostic-37.json';
import { parsePuzzleFile } from './puzzleFile';

const minimal = {
  grid: { columns: 2, rows: ['1A 2A'] },
  clues: [{ label: 'A', text: 'Clue', cells: [1, 2] }],
};

describe('parsePuzzleFile', () => {
  it('reads the sample puzzle into a valid puzzle', () => {
    const result = parsePuzzleFile(sample);
    if (!result.ok) throw new Error(result.error);
    expect(result.value.title).toBe('Diplo-Crostic No. 37');
    expect(result.value.constructedBy).toBe('Carol Becker');
    expect(result.value.clues).toHaveLength(26);
    expect(validatePuzzle(result.value)).toEqual([]);
  });

  it('ignores unknown fields', () => {
    const result = parsePuzzleFile({ ...minimal, $comment: 'hi', errata: [] });
    expect(result.ok && Object.keys(result.value)).toEqual(['grid', 'clues']);
  });

  it.each([
    ['not an object', 'nope'],
    ['missing grid', { clues: [] }],
    ['zero columns', { ...minimal, grid: { columns: 0, rows: ['1A'] } }],
    ['no rows', { ...minimal, grid: { columns: 2, rows: [] } }],
    ['non-integer blank', { ...minimal, clues: [{ label: 'A', text: 'x', cells: [1.5] }] }],
  ])('rejects %s', (_label, data) => {
    expect(parsePuzzleFile(data).ok).toBe(false);
  });

  it('reports grid format errors', () => {
    const result = parsePuzzleFile({ ...minimal, grid: { columns: 2, rows: ['1A x'] } });
    expect(result).toEqual({ ok: false, error: 'Row 1: unrecognized square "x"' });
  });
});
