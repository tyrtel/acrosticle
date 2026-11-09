import { describe, expect, it } from 'vitest';
import { clueLabel, isLetter, normalizeLetter } from './letters';

describe('isLetter', () => {
  it.each(['A', 'M', 'Z'])('accepts %s', (value) => {
    expect(isLetter(value)).toBe(true);
  });

  it.each(['a', '', 'AB', '1', ' ', 'É'])('rejects %j', (value) => {
    expect(isLetter(value)).toBe(false);
  });
});

describe('normalizeLetter', () => {
  it('uppercases lowercase input', () => {
    expect(normalizeLetter('q')).toBe('Q');
  });

  it('trims surrounding whitespace', () => {
    expect(normalizeLetter('  x ')).toBe('X');
  });

  it('strips diacritics', () => {
    expect(normalizeLetter('é')).toBe('E');
  });

  it.each(['', '  ', 'ab', '7', '?'])('returns null for %j', (value) => {
    expect(normalizeLetter(value)).toBeNull();
  });
});

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
