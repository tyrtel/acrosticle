import { describe, expect, it } from 'vitest';
import { parseCellList } from './parseCellList';

describe('parseCellList', () => {
  it.each([
    ['138 5 44', [138, 5, 44]],
    ['138, 5,44', [138, 5, 44]],
    ['  7  ', [7]],
    ['', []],
  ])('parses %j', (text, cells) => {
    expect(parseCellList(text)).toEqual({ ok: true, cells });
  });

  it.each(['1 2a', '1.5', '-3', 'x'])('rejects %j', (text) => {
    expect(parseCellList(text).ok).toBe(false);
  });

  it('names the bad token', () => {
    expect(parseCellList('1 2a 3')).toEqual({ ok: false, error: '"2a" is not a square number' });
  });
});
