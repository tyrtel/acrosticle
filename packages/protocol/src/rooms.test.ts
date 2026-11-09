import { describe, expect, it } from 'vitest';
import { CreateRoomRequest, RoomId, roomPath, roomSocketPath } from './rooms';

describe('RoomId', () => {
  it('accepts 22 base64url characters', () => {
    expect(RoomId.safeParse('AbCdEfGhIjKlMnOpQrSt_-').success).toBe(true);
  });

  it.each(['short', 'AbCdEfGhIjKlMnOpQrSt_-x', 'AbCdEfGhIjKlMnOpQrSt/+'])('rejects %j', (id) => {
    expect(RoomId.safeParse(id).success).toBe(false);
  });
});

describe('CreateRoomRequest', () => {
  it('requires a puzzle file', () => {
    expect(CreateRoomRequest.safeParse({}).success).toBe(false);
    expect(
      CreateRoomRequest.safeParse({
        puzzle: {
          grid: { columns: 1, rows: ['1A'] },
          clues: [{ label: 'A', text: 'x', cells: [1] }],
        },
      }).success,
    ).toBe(true);
  });
});

describe('paths', () => {
  it('builds the room page and socket paths', () => {
    expect(roomPath('abc')).toBe('/r/abc');
    expect(roomSocketPath('abc')).toBe('/api/rooms/abc/ws');
  });
});
