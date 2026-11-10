import type { PuzzleFile } from '@acrosticle/protocol';
import { describe, expect, it } from 'vitest';
import { scoreParse, similarity } from './evalScore.ts';

const truth: PuzzleFile = {
  grid: { columns: 4, rows: ['1A 2B # 3A', '4B # 5A'] },
  clues: [
    { label: 'A', text: 'First clue', cells: [3, 1, 5] },
    { label: 'B', text: 'Second', cells: [4, 2] },
  ],
};

describe('scoreParse', () => {
  it('scores a perfect parse as 1 everywhere', () => {
    expect(scoreParse(truth, truth)).toEqual({
      squareNumbers: 1,
      squareLabels: 1,
      clueBlanks: 1,
      clueText: 1,
      sameShape: true,
    });
  });

  it('counts misread numbers, labels, blanks and text', () => {
    const parsed: PuzzleFile = {
      grid: { columns: 4, rows: ['1A 2A # 8A', '4B # 5A'] },
      clues: [
        { label: 'A', text: 'first  CLUE', cells: [3, 1, 5] },
        { label: 'B', text: 'Secnd', cells: [4, 9] },
      ],
    };
    const score = scoreParse(parsed, truth);
    expect(score.squareNumbers).toBeCloseTo(6 / 7); // 3 misread as 8
    expect(score.squareLabels).toBeCloseTo(3 / 5); // 2B labelled A, and 8A
    expect(score.clueBlanks).toBe(0.5);
    expect(score.clueText).toBeCloseTo((1 + 5 / 6) / 2);
    expect(score.sameShape).toBe(true);
  });

  it('notices a different grid shape, and missing clues', () => {
    const parsed: PuzzleFile = { grid: { columns: 3, rows: ['1A 2B #'] }, clues: [] };
    const score = scoreParse(parsed, truth);
    expect(score.sameShape).toBe(false);
    expect(score.clueBlanks).toBe(0);
    expect(score.clueText).toBe(0);
  });
});

describe('similarity', () => {
  it('ignores case and spacing, and grades differences', () => {
    expect(similarity('A  b', 'a b')).toBe(1);
    expect(similarity('abcd', 'abcf')).toBe(0.75);
    expect(similarity('', '')).toBe(1);
  });
});
