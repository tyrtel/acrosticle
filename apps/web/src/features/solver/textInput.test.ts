import { describe, expect, it } from 'vitest';
import { entriesFromText } from './textInput';

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

  it('skips characters made of several code points that do not compose into one', () => {
    expect(entriesFromText('👍🏽x')).toEqual(['x']);
  });

  it('returns nothing for empty text', () => {
    expect(entriesFromText('')).toEqual([]);
  });
});
