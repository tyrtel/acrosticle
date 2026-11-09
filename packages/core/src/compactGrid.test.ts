import { describe, expect, it } from 'vitest';
import { parseCompactGrid, puzzleFromCompact } from './compactGrid';

describe('puzzleFromCompact', () => {
  const clues = [{ label: 'A', text: 'Clue', cells: [1, 2] }];

  it('builds a puzzle, keeping only the metadata that is present', () => {
    const result = puzzleFromCompact({ title: 'T', grid: { columns: 2, rows: ['1A 2A'] }, clues });
    expect(result).toEqual({
      ok: true,
      puzzle: {
        title: 'T',
        grid: {
          columns: 2,
          squares: [
            { kind: 'letter', number: 1, clue: 'A' },
            { kind: 'letter', number: 2, clue: 'A' },
          ],
        },
        clues,
      },
    });
  });

  it('keeps constructor and source', () => {
    const result = puzzleFromCompact({
      constructedBy: 'C',
      source: 'S',
      grid: { columns: 1, rows: ['1A'] },
      clues,
    });
    expect(result.ok && result.puzzle).toMatchObject({ constructedBy: 'C', source: 'S' });
  });

  it('passes through grid errors', () => {
    expect(puzzleFromCompact({ grid: { columns: 2, rows: ['1A ?!'] }, clues })).toEqual({
      ok: false,
      error: 'Row 1: unrecognized square "?!"',
    });
  });
});

describe('parseCompactGrid', () => {
  it('parses letters, blocks and punctuation in reading order', () => {
    const result = parseCompactGrid(3, ['1A # 2B', "' 3AA"]);
    expect(result).toEqual({
      ok: true,
      grid: {
        columns: 3,
        squares: [
          { kind: 'letter', number: 1, clue: 'A' },
          { kind: 'block' },
          { kind: 'letter', number: 2, clue: 'B' },
          { kind: 'punctuation', char: "'" },
          { kind: 'letter', number: 3, clue: 'AA' },
        ],
      },
    });
  });

  it('tolerates extra whitespace', () => {
    const result = parseCompactGrid(2, ['  1A    2B ']);
    expect(result.ok).toBe(true);
  });

  it.each([
    ['zero columns', 0, ['1A']],
    ['fractional columns', 1.5, ['1A']],
    ['no rows', 2, []],
    ['a short middle row', 2, ['1A', '2B 3A']],
    ['a long row', 2, ['1A 2B 3A']],
    ['an empty last row', 2, ['1A 2B', '   ']],
    ['a lowercase label', 2, ['1a 2B']],
    ['a label with no number', 2, ['A 2B']],
    ['a multi-character symbol', 2, ['1A ,,']],
  ])('rejects %s', (_label, columns, rows) => {
    const result = parseCompactGrid(columns, rows);
    expect(result.ok).toBe(false);
  });

  it('names the offending row and token', () => {
    expect(parseCompactGrid(2, ['1A 2B', '3A x'])).toEqual({
      ok: false,
      error: 'Row 2: unrecognized square "x"',
    });
  });
});
