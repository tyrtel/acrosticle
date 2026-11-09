import { describe, expect, it } from 'vitest';
import { MEMBER_COLORS, pickColor } from './colors';

describe('pickColor', () => {
  it('starts with the first color', () => {
    expect(pickColor([])).toBe(MEMBER_COLORS[0]);
  });

  it('picks an unused color while any remain', () => {
    expect(pickColor([MEMBER_COLORS[0], MEMBER_COLORS[1]])).toBe(MEMBER_COLORS[2]);
  });

  it('reuses the least-used color once all are taken', () => {
    const all = [...MEMBER_COLORS, MEMBER_COLORS[0]];
    expect(pickColor(all)).toBe(MEMBER_COLORS[1]);
  });

  it('ignores unknown colors', () => {
    expect(pickColor(['#000000'])).toBe(MEMBER_COLORS[0]);
  });
});
