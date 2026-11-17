import { validatePuzzle } from '@gridicles/acrostic';
import { describe, expect, it } from 'vitest';
import sample from '../../../samples/puzzles/diplo-crostic-37.json';
import mini from '../../../samples/puzzles/gridicles-mini-1.json';
import {
  parseAcrosticFile,
  parseCrosswordFile,
  publicPuzzleFile,
  PuzzleFile,
  puzzleKindOf,
  puzzleTitleOf,
} from './puzzleFile';

const minimal = {
  grid: { columns: 2, rows: ['1A 2A'] },
  clues: [{ label: 'A', text: 'Clue', cells: [1, 2] }],
};

describe('parseAcrosticFile', () => {
  it('reads the sample puzzle into a valid puzzle', () => {
    const result = parseAcrosticFile(sample);
    if (!result.ok) throw new Error(result.error);
    expect(result.value.title).toBe('Diplo-Crostic No. 37');
    expect(result.value.constructedBy).toBe('Carol Becker');
    expect(result.value.clues).toHaveLength(26);
    expect(validatePuzzle(result.value)).toEqual([]);
  });

  it('ignores unknown fields', () => {
    const result = parseAcrosticFile({ ...minimal, $comment: 'hi', errata: [] });
    expect(result.ok && Object.keys(result.value)).toEqual(['grid', 'clues']);
  });

  it.each([
    ['not an object', 'nope'],
    ['missing grid', { clues: [] }],
    ['zero columns', { ...minimal, grid: { columns: 0, rows: ['1A'] } }],
    ['no rows', { ...minimal, grid: { columns: 2, rows: [] } }],
    ['non-integer blank', { ...minimal, clues: [{ label: 'A', text: 'x', cells: [1.5] }] }],
  ])('rejects %s', (_label, data) => {
    expect(parseAcrosticFile(data).ok).toBe(false);
  });

  it('reports grid format errors', () => {
    const result = parseAcrosticFile({ ...minimal, grid: { columns: 2, rows: ['1A x'] } });
    expect(result).toEqual({ ok: false, error: 'Row 1: unrecognized square "x"' });
  });
});

describe('PuzzleFile', () => {
  it('reads a file without a kind as an acrostic, and a crossword by its kind', () => {
    const acrostic = PuzzleFile.parse(minimal);
    expect(puzzleKindOf(acrostic)).toBe('acrostic');
    const crossword = PuzzleFile.parse(mini);
    expect(puzzleKindOf(crossword)).toBe('crossword');
    expect(puzzleTitleOf(crossword)).toBe('Gridicles Mini No. 1');
  });

  it('rejects a crossword file with an acrostic shape, and the reverse', () => {
    expect(PuzzleFile.safeParse({ ...minimal, kind: 'crossword' }).success).toBe(false);
    expect(PuzzleFile.safeParse({ ...mini, kind: 'acrostic' }).success).toBe(false);
  });

  it('bounds crossword sizes and text', () => {
    expect(PuzzleFile.safeParse({ ...mini, grid: Array(41).fill('A') }).success).toBe(false);
    expect(
      PuzzleFile.safeParse({
        ...mini,
        clues: { across: [{ number: 1, text: 'x'.repeat(2001) }], down: [] },
      }).success,
    ).toBe(false);
  });
});

describe('publicPuzzleFile', () => {
  it('removes crossword answers, keeping black squares and markings', () => {
    const file = PuzzleFile.parse({ ...mini, rebus: { 13: 'HEART' }, circled: [1] });
    expect(publicPuzzleFile(file)).toEqual({
      ...file,
      rebus: undefined,
      grid: ['...##', '....#', '.....', '#....', '##...'],
    });
    expect(publicPuzzleFile(file)).not.toHaveProperty('rebus');
  });

  it('leaves acrostics as they are', () => {
    const file = PuzzleFile.parse(minimal);
    expect(publicPuzzleFile(file)).toBe(file);
  });
});

describe('parseCrosswordFile', () => {
  it('reads the sample crossword', () => {
    const result = parseCrosswordFile(mini);
    expect(result.ok && result.value.width).toBe(5);
  });

  it('reports shape and grid errors', () => {
    expect(parseCrosswordFile({ kind: 'crossword' }).ok).toBe(false);
    expect(parseCrosswordFile({ ...mini, grid: ['AB', 'C'] })).toEqual({
      ok: false,
      error: 'Row 2 has 1 squares, but row 1 has 2.',
    });
  });
});

describe('CrosswordFile layouts', () => {
  it('accepts bars and the rows-and-columns style, and keeps them for browsers', () => {
    const file = PuzzleFile.parse({
      ...mini,
      style: 'rows-columns',
      bars: { right: [1], bottom: [2] },
    });
    expect(publicPuzzleFile(file)).toMatchObject({
      style: 'rows-columns',
      bars: { right: [1], bottom: [2] },
    });
    expect(PuzzleFile.safeParse({ ...mini, style: 'diagonal' }).success).toBe(false);
  });
});
