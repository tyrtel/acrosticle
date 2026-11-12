import { describe, expect, it } from 'vitest';
import { shortDateTime } from './dateTime';

const now = Date.UTC(2026, 10, 12, 12, 0, 0);
const format = (timestamp: number) => shortDateTime(timestamp, now, 'en-US', 'UTC');

describe('shortDateTime', () => {
  it('shows month, day and time for this year', () => {
    expect(format(Date.UTC(2026, 10, 10, 15, 42))).toBe('Nov 10, 3:42 PM');
  });

  it('adds the year for other years', () => {
    expect(format(Date.UTC(2025, 0, 2, 9, 5))).toBe('Jan 2, 2025, 9:05 AM');
  });

  it('uses the given time zone, including for the year', () => {
    // 1 Jan 2026 03:00 UTC is still 31 Dec 2025 in New York.
    expect(shortDateTime(Date.UTC(2026, 0, 1, 3, 0), now, 'en-US', 'America/New_York')).toBe(
      'Dec 31, 2025, 10:00 PM',
    );
  });
});
