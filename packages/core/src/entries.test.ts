import { describe, expect, it } from 'vitest';
import { firstCharacter, isEntry, MAX_ENTRY_LENGTH, normalizeEntry, type Entry } from './entries';

describe('isEntry', () => {
  it.each(['A', 'z', 'é', 'ß', 'Ж', 'あ', '7', '?', '&', '$', '€', "'"])(
    'accepts the single character %j',
    (value) => {
      expect(isEntry(value)).toBe(true);
    },
  );

  it.each(['AB', 'ab', '12', 'THE', 'E or I', 'E/I', 'a b c', 'ねこ'])(
    'accepts the multi-character entry %j',
    (value) => {
      expect(isEntry(value)).toBe(true);
    },
  );

  it.each([
    ['empty', ''],
    ['a space', ' '],
    ['a tab', '\t'],
    ['a newline', '\n'],
    ['a control character', '\u0007'],
    ['a decomposed accent (not NFC)', 'é'],
    ['a leading space', ' A'],
    ['a trailing space', 'A '],
    ['two spaces in a row', 'A  B'],
    ['a tab between characters', 'A\tB'],
    ['a newline between characters', 'A\nB'],
    ['a control character between characters', 'A\u0000B'],
  ])('rejects %s', (_, value) => {
    expect(isEntry(value)).toBe(false);
  });

  it('accepts up to MAX_ENTRY_LENGTH characters, counting characters rather than UTF-16 units', () => {
    expect(isEntry('A'.repeat(MAX_ENTRY_LENGTH))).toBe(true);
    expect(isEntry('A'.repeat(MAX_ENTRY_LENGTH + 1))).toBe(false);
    // '𝔸' takes two UTF-16 units but is one character.
    expect(isEntry('𝔸'.repeat(MAX_ENTRY_LENGTH))).toBe(true);
  });

  it('counts spaces towards the limit', () => {
    const pairs = 'A '.repeat(MAX_ENTRY_LENGTH / 2);
    expect(isEntry(`${pairs}A`)).toBe(false);
    expect(isEntry(pairs.trimEnd())).toBe(true);
  });
});

describe('normalizeEntry', () => {
  it('keeps case as typed', () => {
    expect(normalizeEntry('q')).toBe('q');
    expect(normalizeEntry('Q')).toBe('Q');
    expect(normalizeEntry('Th')).toBe('Th');
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
    expect(normalizeEntry('\tTH\n')).toBe('TH');
  });

  it('turns any run of inner whitespace into one space', () => {
    expect(normalizeEntry('E   or\tI')).toBe('E or I');
    expect(normalizeEntry('A\n\nB')).toBe('A B');
  });

  it.each(['', '  ', '\u0000', 'A\u0007B', 'A'.repeat(MAX_ENTRY_LENGTH + 1)])(
    'returns null for %j',
    (value) => {
      expect(normalizeEntry(value)).toBeNull();
    },
  );
});

describe('firstCharacter', () => {
  const entry = (value: string) => normalizeEntry(value) as Entry;

  it.each([
    ['A', 'A'],
    ['THE', 'T'],
    ['th', 't'],
    ['E or I', 'E'],
    ['𝔸B', '𝔸'],
  ])('%j -> %j', (value, expected) => {
    expect(firstCharacter(entry(value))).toBe(expected);
  });

  it('returns a valid entry', () => {
    expect(isEntry(firstCharacter(entry('𝔸 B')))).toBe(true);
  });
});
