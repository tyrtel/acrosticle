import { describe, expect, it } from 'vitest';
import { SITES, siteFor } from './site';

describe('siteFor', () => {
  it('is Crosswordicle for "crossword" and Acrosticle otherwise', () => {
    expect(siteFor('crossword')).toBe(SITES.crossword);
    expect(siteFor('acrostic')).toBe(SITES.acrostic);
    expect(siteFor(undefined)).toBe(SITES.acrostic);
    expect(siteFor('nonsense')).toBe(SITES.acrostic);
  });
});
