import { describe, expect, it } from 'vitest';
import { appOrigin, canCreate, signInConfigured } from './auth';
import { safeReturnPath } from './authRoutes';

const ada = { id: 'u1', name: 'Ada', email: 'Ada@Example.com', picture: null };

describe('canCreate', () => {
  it('checks the allowlist ignoring case and spaces', () => {
    expect(canCreate(ada, { CREATOR_ALLOWLIST: ' ada@example.com , x@y.z ' })).toBe(true);
    expect(canCreate(ada, { CREATOR_ALLOWLIST: 'x@y.z' })).toBe(false);
    expect(canCreate(ada, { CREATOR_ALLOWLIST: '' })).toBe(false);
    expect(canCreate(null, { CREATOR_ALLOWLIST: 'ada@example.com' })).toBe(false);
    expect(canCreate(ada, {} as { CREATOR_ALLOWLIST: string })).toBe(false);
  });
});

describe('signInConfigured', () => {
  it('needs both the client id and secret', () => {
    expect(signInConfigured({ GOOGLE_CLIENT_ID: 'id', GOOGLE_CLIENT_SECRET: 's' })).toBe(true);
    expect(signInConfigured({ GOOGLE_CLIENT_ID: 'id', GOOGLE_CLIENT_SECRET: '' })).toBe(false);
    expect(signInConfigured({ GOOGLE_CLIENT_ID: '', GOOGLE_CLIENT_SECRET: 's' })).toBe(false);
  });
});

describe('appOrigin', () => {
  it('prefers the configured origin, else the request origin', () => {
    const request = new Request('http://localhost:8787/api/me');
    expect(appOrigin(request, { APP_ORIGIN: 'https://app.test' })).toBe('https://app.test');
    expect(appOrigin(request, { APP_ORIGIN: '' })).toBe('http://localhost:8787');
  });
});

describe('safeReturnPath', () => {
  it.each([
    ['/r/abc', '/r/abc'],
    ['/my?x=1', '/my?x=1'],
    [null, '/'],
    ['', '/'],
    ['//evil.example', '/'],
    ['https://evil.example', '/'],
    ['/\\evil.example', '/'],
  ])('%j -> %j', (input, expected) => {
    expect(safeReturnPath(input)).toBe(expected);
  });
});
