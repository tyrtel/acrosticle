import { describe, expect, it } from 'vitest';
import {
  checkClientId,
  checkClientSecret,
  LOCAL_CALLBACK,
  mask,
  missingRedirectUris,
  parseAllowlist,
  parseDevVars,
  PRODUCTION_CALLBACK,
  readClientJson,
  updateDevVars,
} from './signinConfig.ts';

describe('parseDevVars', () => {
  it('reads keys, skipping comments and blanks, and strips quotes', () => {
    const vars = parseDevVars('# comment\nA=1\n\n B = "two words" \nC=\'3\'\n#D=4\n');
    expect([...vars]).toEqual([
      ['A', '1'],
      ['B', 'two words'],
      ['C', '3'],
    ]);
  });
});

describe('updateDevVars', () => {
  it('replaces values in place, keeps comments and other keys, appends new keys', () => {
    const before = '# Google\nGOOGLE_CLIENT_ID=\nOTHER=keep\n# CREATOR_ALLOWLIST=commented\n';
    const after = updateDevVars(
      before,
      new Map([
        ['GOOGLE_CLIENT_ID', 'id.apps.googleusercontent.com'],
        ['CREATOR_ALLOWLIST', 'a@b.co'],
      ]),
    );
    expect(after).toBe(
      '# Google\nGOOGLE_CLIENT_ID=id.apps.googleusercontent.com\nOTHER=keep\n# CREATOR_ALLOWLIST=commented\nCREATOR_ALLOWLIST=a@b.co\n',
    );
  });

  it('writes a fresh file', () => {
    expect(updateDevVars('', new Map([['A', '1']]))).toBe('A=1\n');
  });
});

describe('checkClientId', () => {
  it.each([
    ['123-abc.apps.googleusercontent.com', true],
    ['', false],
    ['123-abc', false],
    ['123 abc.apps.googleusercontent.com', false],
  ])('%j -> %s', (value, ok) => {
    expect(checkClientId(value).ok).toBe(ok);
  });
});

describe('checkClientSecret', () => {
  it.each([
    ['GOCSPX-abcdefghijklmnopqrstuvwx', true],
    ['', false],
    ['short', false],
    ['GOCSPX-abc defghijklmnopqrstuvwx', false],
  ])('%j -> %s', (value, ok) => {
    expect(checkClientSecret(value).ok).toBe(ok);
  });
});

describe('parseAllowlist', () => {
  it('normalizes, de-duplicates and flags non-emails', () => {
    expect(parseAllowlist(' Tyrtel@Gmail.com, a@b.co tyrtel@gmail.com nope ')).toEqual({
      emails: ['tyrtel@gmail.com', 'a@b.co'],
      invalid: ['nope'],
    });
  });
});

describe('readClientJson', () => {
  it('reads a web client download', () => {
    const json = JSON.stringify({
      web: {
        client_id: 'x.apps.googleusercontent.com',
        client_secret: 'GOCSPX-s',
        redirect_uris: [LOCAL_CALLBACK],
      },
    });
    expect(readClientJson(json)).toEqual({
      clientId: 'x.apps.googleusercontent.com',
      clientSecret: 'GOCSPX-s',
      redirectUris: [LOCAL_CALLBACK],
    });
  });

  it.each([
    ['not json', '{', "isn't valid JSON"],
    ['a desktop client', '{"installed":{}}', 'has no "web" section'],
    ['missing secret', '{"web":{"client_id":"x"}}', 'is missing client_id or client_secret'],
  ])('explains %s', (_label, text, error) => {
    expect(readClientJson(text)).toEqual({ error: expect.stringContaining(error) as unknown });
  });
});

describe('missingRedirectUris', () => {
  it('lists the app callbacks not registered with Google', () => {
    expect(missingRedirectUris([LOCAL_CALLBACK])).toEqual([PRODUCTION_CALLBACK]);
    expect(missingRedirectUris([LOCAL_CALLBACK, PRODUCTION_CALLBACK])).toEqual([]);
    expect(missingRedirectUris([`${LOCAL_CALLBACK}/`])).toHaveLength(2);
  });
});

describe('mask', () => {
  it('shows only the ends of a secret', () => {
    expect(mask('GOCSPX-abcdefghijkl')).toBe('GOCS…ijkl');
    expect(mask('short')).toBe('••••');
  });
});
