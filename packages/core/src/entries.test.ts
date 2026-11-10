import { describe, expect, it } from 'vitest';
import { isEntry, normalizeEntry } from './entries';

describe('isEntry', () => {
  it.each(['A', 'z', 'é', 'ß', 'Ж', 'あ', '7', '?', '&', '$', '€', "'"])('accepts %j', (value) => {
    expect(isEntry(value)).toBe(true);
  });

  it.each(['', ' ', '\t', '\n', 'AB', 'ab', '12', '\u0007', 'é'])('rejects %j', (value) => {
    expect(isEntry(value)).toBe(false);
  });
});

describe('normalizeEntry', () => {
  it('keeps case as typed', () => {
    expect(normalizeEntry('q')).toBe('q');
    expect(normalizeEntry('Q')).toBe('Q');
  });

  it('accepts digits, symbols and letters from any alphabet', () => {
    expect(normalizeEntry('7')).toBe('7');
    expect(normalizeEntry('!')).toBe('!');
    expect(normalizeEntry('ñ')).toBe('ñ');
  });

  it('composes a letter typed with a separate accent into one character', () => {
    expect(normalizeEntry('é')).toBe('é');
  });

  it('trims surrounding whitespace', () => {
    expect(normalizeEntry('  x ')).toBe('x');
  });

  it.each(['', '  ', 'ab', '\u0000'])('returns null for %j', (value) => {
    expect(normalizeEntry(value)).toBeNull();
  });
});
