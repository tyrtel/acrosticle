import { describe, expect, it } from 'vitest';
import { clearCookie, readCookie, serializeCookie } from './cookies';

const withCookie = (cookie: string) =>
  new Request('https://x.test', { headers: { Cookie: cookie } });

describe('readCookie', () => {
  it('finds a cookie among others and decodes it', () => {
    expect(readCookie(withCookie('a=1; session=abc%20def; b=2'), 'session')).toBe('abc def');
  });

  it('returns null when absent or undecodable', () => {
    expect(readCookie(new Request('https://x.test'), 'session')).toBeNull();
    expect(readCookie(withCookie('other=1'), 'session')).toBeNull();
    expect(readCookie(withCookie('session=%E0%A4%A'), 'session')).toBeNull();
  });
});

describe('serializeCookie / clearCookie', () => {
  it('always sets the safe attributes', () => {
    expect(serializeCookie('s', 'v w', { maxAgeSeconds: 60, path: '/api' })).toBe(
      's=v%20w; Max-Age=60; Path=/api; HttpOnly; Secure; SameSite=Lax',
    );
    expect(clearCookie('s')).toBe('s=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax');
  });
});
