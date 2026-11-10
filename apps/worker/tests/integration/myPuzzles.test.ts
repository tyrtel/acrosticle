import type { MyRoomsResponse } from '@acrosticle/protocol';
import { exports } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { ROOM_DELETED_CLOSE_CODE } from '../../src/room/PuzzleRoom';
import { signInAs } from '../support/accounts';
import { BASE, postRoom, TestClient, tinyPuzzleFile } from '../support/rooms';

// The database isn't reset between tests. Creators must be on the test allowlist (so they're
// shared), so checks look only at the rooms each test creates; visitors are unique users.
const creator = () => signInAs('ada@example.com', 'Ada');
const visitor = (name: string) => signInAs(`${name}-${crypto.randomUUID()}@example.com`, name);

async function myRooms(
  cookie: string,
  only?: readonly string[],
): Promise<MyRoomsResponse['rooms']> {
  const res = await exports.default.fetch(`${BASE}/api/me/rooms`, { headers: { Cookie: cookie } });
  const { rooms } = await res.json<MyRoomsResponse>();
  return only ? rooms.filter((room) => only.includes(room.roomId)) : rooms;
}

const createAs = async (cookie: string) =>
  (await (await postRoom({ puzzle: tinyPuzzleFile }, cookie)).json<{ roomId: string }>()).roomId;

const deleteRoom = (roomId: string, cookie?: string) =>
  exports.default.fetch(`${BASE}/api/rooms/${roomId}`, {
    method: 'DELETE',
    headers: { Origin: BASE, ...(cookie ? { Cookie: cookie } : {}) },
  });

/** Waits for background writes (visits, activity) to land. */
async function eventually<T>(read: () => Promise<T>, done: (value: T) => boolean): Promise<T> {
  for (let i = 0; ; i++) {
    const value = await read();
    if (done(value) || i === 50) return value;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

describe('My puzzles list', () => {
  it('includes rooms the user joined, marked as not theirs', async () => {
    const ada = await creator();
    const bo = await visitor('Bo');
    const roomId = await createAs(ada.cookie);

    const { client } = await TestClient.join(roomId, 'Bo', bo.cookie);
    const rooms = await eventually(
      () => myRooms(bo.cookie),
      (list) => list.length > 0,
    );
    expect(rooms).toMatchObject([{ roomId, title: 'Tiny', createdByMe: false }]);
    expect(await myRooms(ada.cookie, [roomId])).toMatchObject([{ roomId, createdByMe: true }]);
    client.close();
  });

  it('does not record visits for people who are signed out', async () => {
    const ada = await creator();
    const roomId = await createAs(ada.cookie);
    const { client } = await TestClient.join(roomId, 'Anon');
    client.close();
    const bo = await visitor('Bo');
    expect(await myRooms(bo.cookie)).toEqual([]);
  });

  it('puts the most recently edited room first', async () => {
    const ada = await creator();
    const older = await createAs(ada.cookie);
    await new Promise((resolve) => setTimeout(resolve, 5));
    const newer = await createAs(ada.cookie);
    const ids = async () => (await myRooms(ada.cookie, [older, newer])).map((r) => r.roomId);
    expect(await ids()).toEqual([newer, older]);

    await new Promise((resolve) => setTimeout(resolve, 5));
    const { client } = await TestClient.join(older, 'Ada', ada.cookie);
    client.send({ type: 'cell/set', cell: 1, value: 'x', clientSeq: 1 });
    await client.next('cell/updated');

    expect(await eventually(ids, (order) => order[0] === older)).toEqual([older, newer]);
    client.close();
  });
});

describe('DELETE /api/rooms/:id', () => {
  it('lets the creator delete a room for everyone', async () => {
    const ada = await creator();
    const bo = await visitor('Bo');
    const roomId = await createAs(ada.cookie);
    const { client } = await TestClient.join(roomId, 'Bo', bo.cookie);
    await eventually(
      () => myRooms(bo.cookie),
      (list) => list.length > 0,
    );

    expect((await deleteRoom(roomId, ada.cookie)).status).toBe(204);

    // People in the room are told, then disconnected.
    expect(await client.next('room/deleted')).toEqual({ type: 'room/deleted' });
    expect(await client.closed).toBe(ROOM_DELETED_CLOSE_CODE);

    // The room is gone: lookups, joins and everyone's lists.
    expect((await exports.default.fetch(`${BASE}/api/rooms/${roomId}`)).status).toBe(404);
    const rejoin = await exports.default.fetch(`${BASE}/api/rooms/${roomId}/ws`, {
      headers: { Upgrade: 'websocket' },
    });
    expect(rejoin.status).toBe(404);
    expect(await myRooms(ada.cookie, [roomId])).toEqual([]);
    expect(await myRooms(bo.cookie)).toEqual([]);
  });

  it('requires sign-in', async () => {
    const ada = await creator();
    const roomId = await createAs(ada.cookie);
    expect((await deleteRoom(roomId)).status).toBe(401);
  });

  it("refuses to delete someone else's room, or an anonymous sample room", async () => {
    const ada = await creator();
    const bo = await visitor('Bo');
    const adas = await createAs(ada.cookie);
    expect((await deleteRoom(adas, bo.cookie)).status).toBe(403);

    const sample = (
      await (await postRoom({ sample: 'diplo-crostic-37' })).json<{ roomId: string }>()
    ).roomId;
    expect((await deleteRoom(sample, ada.cookie)).status).toBe(403);
    expect((await exports.default.fetch(`${BASE}/api/rooms/${adas}`)).status).toBe(200);
  });

  it('returns 404 for an unknown room', async () => {
    const ada = await creator();
    expect((await deleteRoom('AAAAAAAAAAAAAAAAAAAAAA', ada.cookie)).status).toBe(404);
  });

  it('rejects cross-site deletes', async () => {
    const ada = await creator();
    const roomId = await createAs(ada.cookie);
    const res = await exports.default.fetch(`${BASE}/api/rooms/${roomId}`, {
      method: 'DELETE',
      headers: { Origin: 'https://evil.example', Cookie: ada.cookie },
    });
    expect(res.status).toBe(403);
  });
});
