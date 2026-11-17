import { describe, expect, it } from 'vitest';
import { blankCrossword, resizeCrossword, toggleBlock } from './editing';

const kinds = (squares: readonly { kind: string }[]) =>
  squares.map((s) => (s.kind === 'block' ? '#' : '.')).join('');

describe('blankCrossword', () => {
  it('makes an all-open grid, kept within the allowed sizes', () => {
    const blank = blankCrossword(3, 2);
    expect([blank.width, blank.height, kinds(blank.squares)]).toEqual([3, 2, '......']);
    expect(blankCrossword(1, 99)).toMatchObject({ width: 2, height: 40 });
    expect(blankCrossword(Number.NaN, 2.6)).toMatchObject({ width: 2, height: 3 });
  });
});

describe('toggleBlock', () => {
  it('toggles a square and, with symmetry, its mirror square', () => {
    const blank = blankCrossword(3, 3);
    const one = toggleBlock(blank, 1, true);
    expect(kinds(one.squares)).toBe('#.......#');
    expect(kinds(toggleBlock(one, 9, true).squares)).toBe('.........');
    expect(kinds(toggleBlock(blank, 1, false).squares)).toBe('#........');
    // The middle square is its own mirror.
    expect(kinds(toggleBlock(blank, 5, true).squares)).toBe('....#....');
    expect(kinds(blank.squares)).toBe('.........');
  });

  it('rejects a square off the grid', () => {
    expect(() => toggleBlock(blankCrossword(2, 2), 9, true)).toThrow(RangeError);
  });
});

describe('resizeCrossword', () => {
  it('keeps the top-left squares and opens new ones', () => {
    const grid = toggleBlock(blankCrossword(3, 3), 1, false);
    expect(kinds(resizeCrossword(grid, 2, 2).squares)).toBe('#...');
    const bigger = resizeCrossword(grid, 4, 3);
    expect([bigger.width, kinds(bigger.squares)]).toEqual([4, '#...........']);
  });
});
