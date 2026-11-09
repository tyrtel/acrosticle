import { ROOM_ID_PATTERN } from '@acrosticle/protocol';
import { describe, expect, it } from 'vitest';
import { newRoomId } from './roomId';

describe('newRoomId', () => {
  it('makes valid, distinct ids', () => {
    const ids = Array.from({ length: 50 }, newRoomId);
    expect(ids.every((id) => ROOM_ID_PATTERN.test(id))).toBe(true);
    expect(new Set(ids).size).toBe(50);
  });
});
