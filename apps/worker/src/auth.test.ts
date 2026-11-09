import { describe, expect, it } from 'vitest';
import { getCurrentUser } from './auth';

const request = new Request('https://acrosticle.test/api/rooms');

describe('getCurrentUser', () => {
  it('denies by default', () => {
    expect(getCurrentUser(request, { DEV_ALLOW_ANONYMOUS: 'false' })).toBeNull();
    expect(getCurrentUser(request, { DEV_ALLOW_ANONYMOUS: '' })).toBeNull();
  });

  it('acts as the development user only when explicitly allowed', () => {
    expect(getCurrentUser(request, { DEV_ALLOW_ANONYMOUS: 'true' })).toEqual({
      id: 'dev-user',
      name: 'Developer',
    });
  });
});
