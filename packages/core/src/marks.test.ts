import { describe, expect, it } from 'vitest';
import { noMarks, setMark } from './marks';

describe('setMark', () => {
  it('highlights and un-highlights a square without mutating its input', () => {
    const marked = setMark(noMarks, 3, true);
    expect([...marked]).toEqual([3]);
    expect(noMarks.size).toBe(0);

    const cleared = setMark(marked, 3, false);
    expect(cleared.size).toBe(0);
    expect([...marked]).toEqual([3]);
  });

  it('returns the same reference when nothing changes', () => {
    const marked = setMark(noMarks, 3, true);
    expect(setMark(marked, 3, true)).toBe(marked);
    expect(setMark(noMarks, 3, false)).toBe(noMarks);
  });
});
