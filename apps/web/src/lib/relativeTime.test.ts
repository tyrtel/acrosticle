import { describe, expect, it } from 'vitest';
import { relativeTime } from './relativeTime';

const now = Date.UTC(2026, 10, 10, 12, 0, 0);
const ago = (ms: number) => relativeTime(now - ms, now, 'en');
const MIN = 60_000;

describe('relativeTime', () => {
  it.each([
    [10_000, 'just now'],
    [5 * MIN, '5 minutes ago'],
    [90 * MIN, '1 hour ago'],
    [26 * 60 * MIN, 'yesterday'],
    [3 * 24 * 60 * MIN, '3 days ago'],
    [15 * 24 * 60 * MIN, '2 weeks ago'],
    [400 * 24 * 60 * MIN, 'last year'],
  ])('%i ms ago -> %s', (ms, expected) => {
    expect(ago(ms)).toBe(expected);
  });

  it('treats future times (clock skew) as just now', () => {
    expect(relativeTime(now + 5 * MIN, now, 'en')).toBe('just now');
  });
});
