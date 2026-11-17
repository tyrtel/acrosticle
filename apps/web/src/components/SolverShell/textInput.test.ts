import { describe, expect, it } from 'vitest';
import { MAX_ENTRY_LENGTH } from '@gridicles/core';
import { entriesFromText, entryFromEditBox } from './textInput';

describe('entriesFromText', () => {
  it('turns typed text into one entry per character, keeping case', () => {
    expect(entriesFromText('aB7?')).toEqual(['a', 'B', '7', '?']);
  });

  it('keeps an accent composed from two code points as one entry', () => {
    expect(entriesFromText('é')).toEqual(['é']);
  });

  it('handles IME results and other scripts', () => {
    expect(entriesFromText('ねこ')).toEqual(['ね', 'こ']);
  });

  it('skips spaces and control characters', () => {
    expect(entriesFromText('a b\tc\u0000')).toEqual(['a', 'b', 'c']);
  });

  it('keeps a character made of several code points (emoji with skin tone) as one entry', () => {
    expect(entriesFromText('👍🏽x')).toEqual(['👍🏽', 'x']);
  });

  it('never puts several characters in one entry, even for spaced text', () => {
    expect(entriesFromText('E or I')).toEqual(['E', 'o', 'r', 'I']);
  });

  it('returns nothing for empty text', () => {
    expect(entriesFromText('')).toEqual([]);
  });
});

describe('entryFromEditBox', () => {
  it.each([
    ['TH', 'TH'],
    ['  E   or I ', 'E or I'],
    ['x', 'x'],
    ['', null],
    ['   ', null],
  ])('%j -> %j', (text, expected) => {
    expect(entryFromEditBox(text)).toBe(expected);
  });

  it('refuses text that cannot be an entry', () => {
    expect(entryFromEditBox('A'.repeat(MAX_ENTRY_LENGTH + 1))).toBeUndefined();
    expect(entryFromEditBox('A\u0007B')).toBeUndefined();
  });
});
