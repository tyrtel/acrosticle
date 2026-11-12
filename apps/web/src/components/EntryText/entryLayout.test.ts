import { describe, expect, it } from 'vitest';
import { entryLayout } from './entryLayout';

describe('entryLayout', () => {
  it.each([
    ['A', { text: 'A', size: 'one', callout: false }],
    ['TH', { text: 'TH', size: 'two', callout: false }],
    ['THE', { text: 'THE', size: 'three', callout: false }],
    ['THEN', { text: 'TH\nEN', size: 'lines', callout: true }],
    ['QUEUE', { text: 'QUE\nUE', size: 'lines', callout: true }],
    ['E or I', { text: 'E or\nI', size: 'linesNarrow', callout: true }],
    ['THREES', { text: 'THR\nEES', size: 'lines', callout: true }],
    ['THREESOME', { text: 'THR\nEE…', size: 'lines', callout: true }],
  ])('square: %j', (entry, expected) => {
    expect(entryLayout(entry, 'square')).toEqual(expected);
  });

  it.each([
    ['A', { text: 'A', size: 'one', callout: false }],
    ['TH', { text: 'TH', size: 'wide', callout: false }],
    ['THEN', { text: 'THEN', size: 'wide', callout: false }],
    ['THREE', { text: 'THR…', size: 'wide', callout: true }],
    ['E or I', { text: 'E o…', size: 'wide', callout: true }],
  ])('blank: %j', (entry, expected) => {
    expect(entryLayout(entry, 'blank')).toEqual(expected);
  });

  it.each([
    ['A BC', 'A\nBC', 'lines'],
    ['AB CD', 'AB\nCD', 'lines'],
    ['A B C', 'A B\nC', 'lines'],
    ['ABCD E', 'ABCD\nE', 'linesNarrow'],
    ['AB CDEF', 'AB\nCD…', 'lines'], // cut to "AB CD…" first
  ])('breaks two-line text at the most even space that fits: %j', (entry, text, size) => {
    expect(entryLayout(entry, 'square')).toMatchObject({ text, size });
  });

  it('counts characters, not UTF-16 units', () => {
    expect(entryLayout('𝔸𝔹', 'square')).toEqual({ text: '𝔸𝔹', size: 'two', callout: false });
    expect(entryLayout('𝔸'.repeat(7), 'square').text).toBe(`${'𝔸'.repeat(3)}\n${'𝔸'.repeat(2)}…`);
  });

  it('keeps the longest allowed entry short', () => {
    expect(entryLayout('A'.repeat(100), 'square').text).toBe('AAA\nAA…');
    expect(entryLayout('A'.repeat(100), 'blank').text).toBe('AAA…');
  });
});
