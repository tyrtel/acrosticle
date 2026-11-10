import { describe, expect, it } from 'vitest';
import { clueLabel } from './clueLabel';

describe('clueLabel', () => {
  it.each([
    [0, 'A'],
    [25, 'Z'],
    [26, 'AA'],
    [27, 'BB'],
    [52, 'AAA'],
  ])('index %i -> %s', (index, expected) => {
    expect(clueLabel(index)).toBe(expected);
  });

  it.each([-1, 1.5, Number.NaN])('throws for invalid index %s', (index) => {
    expect(() => clueLabel(index)).toThrow(RangeError);
  });
});
