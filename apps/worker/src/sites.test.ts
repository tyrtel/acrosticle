import { describe, expect, it } from 'vitest';
import { isSiteOrigin, siteOf } from './sites';

const request = new Request('https://worker.example/api/me');

describe('siteOf', () => {
  it('reads both sites from the settings', () => {
    const site = siteOf(request, {
      APP_ORIGIN: 'https://b.test',
      SITE_KIND: 'crossword',
      ACROSTIC_ORIGIN: 'https://a.test',
      CROSSWORD_ORIGIN: 'https://b.test',
      SIGN_IN_ORIGIN: 'https://a.test',
      COOKIE_DOMAIN: 'example.test',
    });
    expect(site).toEqual({
      kind: 'crossword',
      origin: 'https://b.test',
      origins: { acrostic: 'https://a.test', crossword: 'https://b.test' },
      signInOrigin: 'https://a.test',
      cookieDomain: 'example.test',
    });
  });

  it('defaults to a lone acrostic site that signs in itself, with a host-only cookie', () => {
    expect(siteOf(request, { APP_ORIGIN: '' })).toEqual({
      kind: 'acrostic',
      origin: 'https://worker.example',
      origins: { acrostic: 'https://worker.example', crossword: '' },
      signInOrigin: 'https://worker.example',
      cookieDomain: undefined,
    });
  });
});

describe('isSiteOrigin', () => {
  const site = siteOf(request, {
    APP_ORIGIN: 'https://a.test',
    CROSSWORD_ORIGIN: 'https://b.test',
  });

  it('accepts our own sites only', () => {
    expect(isSiteOrigin(site, 'https://a.test')).toBe(true);
    expect(isSiteOrigin(site, 'https://b.test')).toBe(true);
    expect(isSiteOrigin(site, 'https://evil.test')).toBe(false);
    expect(isSiteOrigin(site, '')).toBe(false);
  });
});
