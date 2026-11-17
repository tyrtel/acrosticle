import { describe, expect, it } from 'vitest';
import { mini } from '../tests/support/mini';
import { buildPuz, MINI_PUZ_CLUES, MINI_SOLUTION } from '../tests/support/puzWriter';
import { crosswordFromPuz } from './puz';

const miniPuz = (overrides: Partial<Parameters<typeof buildPuz>[0]> = {}) =>
  buildPuz({
    width: 5,
    height: 5,
    solution: MINI_SOLUTION,
    title: 'Gridicles Mini No. 1',
    author: 'Gridicles',
    clues: MINI_PUZ_CLUES,
    ...overrides,
  });

describe('crosswordFromPuz', () => {
  it('reads the grid, answers, title, author and clues, numbered from the grid', () => {
    expect(crosswordFromPuz(miniPuz())).toEqual({ ok: true, crossword: mini() });
  });

  it('reads the copyright and notes', () => {
    const result = crosswordFromPuz(miniPuz({ copyright: '© 2026', notes: 'Have fun' }));
    expect(result.ok && [result.crossword.copyright, result.crossword.notes]).toEqual([
      '© 2026',
      'Have fun',
    ]);
  });

  it('reads Latin-1 text in older files and UTF-8 in version 2.0 files', () => {
    const latin = crosswordFromPuz(miniPuz({ title: 'Café' }));
    expect(latin.ok && latin.crossword.title).toBe('Café');
    const utf8 = crosswordFromPuz(miniPuz({ version: '2.0', title: 'Café ✓' }));
    expect(utf8.ok && utf8.crossword.title).toBe('Café ✓');
  });

  it('reads rebus squares and circled squares from the extra sections', () => {
    const rebusGrid = new Array(25).fill(0);
    rebusGrid[12] = 1; // the middle square: rebus key 0
    const table = [...' 0:HEART;'].map((ch) => ch.charCodeAt(0));
    const extras = new Array(25).fill(0);
    extras[0] = 0x80;
    const result = crosswordFromPuz(
      miniPuz({
        sections: [
          { name: 'GRBS', data: rebusGrid },
          { name: 'RTBL', data: table },
          { name: 'GEXT', data: extras },
        ],
      }),
    );
    if (!result.ok) throw new Error(result.error);
    expect(result.crossword.squares[12]).toMatchObject({ solution: 'HEART' });
    expect(result.crossword.squares[0]).toMatchObject({ circled: true });
    expect(result.crossword.squares[1]).toMatchObject({ circled: false });
  });

  it('keeps no answers from a scrambled file', () => {
    const result = crosswordFromPuz(miniPuz({ scrambled: true }));
    if (!result.ok) throw new Error(result.error);
    expect(result.crossword.squares.every((s) => s.kind === 'block' || s.solution === null)).toBe(
      true,
    );
  });

  it.each([
    ['a file that is not a .puz', new Uint8Array([1, 2, 3]), /isn't a \.puz/],
    ['a cut-short file', miniPuz().subarray(0, 60), /cut short/],
    ['too few clues', miniPuz({ clueCount: 12 }), /fewer clues/],
    [
      'clues that do not match the grid',
      miniPuz({ clueCount: 9, clues: MINI_PUZ_CLUES.slice(0, 9) }),
      /don't match/,
    ],
    [
      'an empty grid',
      buildPuz({ width: 0, height: 0, solution: '', clues: [] }),
      /isn't supported/,
    ],
  ])('rejects %s', (_label, bytes, error) => {
    const result = crosswordFromPuz(bytes);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(error);
  });
});
