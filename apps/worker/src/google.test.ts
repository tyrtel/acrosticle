import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { idToken, validClaims } from '../tests/support/google';
import { authorizationUrl, codeChallenge, createPkce, readIdToken } from './google';

const now = Date.now();

describe('codeChallenge', () => {
  it('is base64url(SHA-256(verifier)), checked against Node crypto', async () => {
    const verifier = 'dBjftJeZ4CVP-mJ92K9GdX3E1fHFpnB2c_8_TG5y_8M';
    const expected = createHash('sha256').update(verifier).digest('base64url');
    expect(await codeChallenge(verifier)).toBe(expected);
  });

  it('createPkce returns a matching pair', async () => {
    const { verifier, challenge } = await createPkce();
    expect(verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(await codeChallenge(verifier)).toBe(challenge);
  });
});

describe('authorizationUrl', () => {
  it('asks Google to let the user pick an account', () => {
    const url = new URL(
      authorizationUrl({ clientId: 'c', redirectUri: 'r', state: 's', codeChallenge: 'x' }),
    );
    expect(url.searchParams.get('prompt')).toBe('select_account');
  });
});

describe('readIdToken', () => {
  it('extracts the identity from valid claims', () => {
    expect(readIdToken(idToken(validClaims()), 'test-client-id', now)).toEqual({
      ok: true,
      identity: {
        sub: 'google-ada',
        email: 'ada@example.com',
        name: 'Ada Lovelace',
        picture: 'https://example.com/ada.png',
      },
    });
  });

  it('accepts the short issuer form and an audience list', () => {
    const token = idToken(
      validClaims({ iss: 'accounts.google.com', aud: ['other', 'test-client-id'] }),
    );
    expect(readIdToken(token, 'test-client-id', now).ok).toBe(true);
  });

  it('falls back to the email name and no picture', () => {
    const token = idToken(validClaims({ name: '  ', picture: undefined }));
    expect(readIdToken(token, 'test-client-id', now)).toMatchObject({
      identity: { name: 'ada', picture: null },
    });
  });

  it.each([
    ['another issuer', { iss: 'https://evil.example' }],
    ['another audience', { aud: 'someone-else' }],
    ['an expired token', { exp: Math.floor(now / 1000) - 1 }],
    ['a missing subject', { sub: undefined }],
    ['a missing email', { email: undefined }],
  ])('rejects %s', (_label, overrides) => {
    expect(readIdToken(idToken(validClaims(overrides)), 'test-client-id', now)).toEqual({
      ok: false,
      reason: 'failed',
    });
  });

  it('flags unverified emails separately', () => {
    const token = idToken(validClaims({ email_verified: 'true' }));
    expect(readIdToken(token, 'test-client-id', now)).toEqual({ ok: false, reason: 'unverified' });
  });

  it.each(['', 'onlyonepart', 'a.!!!.c', `a.${btoa('not json')}.c`])(
    'rejects malformed token %j',
    (token) => {
      expect(readIdToken(token, 'test-client-id', now).ok).toBe(false);
    },
  );
});
