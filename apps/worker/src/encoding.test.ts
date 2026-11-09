import { describe, expect, it } from 'vitest';
import { fromBase64Url, randomToken, sha256Hex, toBase64Url } from './encoding';

describe('base64url', () => {
  it('round-trips bytes without padding or unsafe characters', () => {
    const bytes = new Uint8Array([251, 255, 0, 1, 62, 63]);
    const text = toBase64Url(bytes);
    expect(text).toBe('-_8AAT4_');
    expect(fromBase64Url(text)).toEqual(bytes);
  });
});

describe('randomToken', () => {
  it('makes distinct tokens of the expected length', () => {
    expect(randomToken(32)).toHaveLength(43);
    expect(randomToken(16)).not.toBe(randomToken(16));
  });
});

describe('sha256Hex', () => {
  it('hashes to lowercase hex', async () => {
    expect(await sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });
});
