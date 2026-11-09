import { describe, expect, it } from 'vitest';
import { MeResponse, MyRoomsResponse, signInPath } from './account';

describe('MeResponse', () => {
  it('accepts signed-out and signed-in shapes', () => {
    expect(
      MeResponse.safeParse({ user: null, canCreate: false, signInConfigured: true }).success,
    ).toBe(true);
    expect(
      MeResponse.safeParse({
        user: { id: 'u1', name: 'Ada', email: 'ada@example.com', picture: null },
        canCreate: true,
        signInConfigured: true,
      }).success,
    ).toBe(true);
  });
});

describe('MyRoomsResponse', () => {
  it('requires valid room ids', () => {
    const room = { roomId: 'AbCdEfGhIjKlMnOpQrSt_-', title: null, createdAt: 1 };
    expect(MyRoomsResponse.safeParse({ rooms: [room] }).success).toBe(true);
    expect(MyRoomsResponse.safeParse({ rooms: [{ ...room, roomId: 'x' }] }).success).toBe(false);
  });
});

describe('signInPath', () => {
  it('encodes the return path', () => {
    expect(signInPath('/r/abc?x=1')).toBe('/api/auth/google?returnTo=%2Fr%2Fabc%3Fx%3D1');
  });
});
