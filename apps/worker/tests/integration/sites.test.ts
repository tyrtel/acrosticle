import type { MyRoomsResponse } from '@gridicles/protocol';
import { env, exports } from 'cloudflare:workers';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { signInAs } from '../support/accounts';
import { miniCrosswordFile } from '../support/crosswords';
import { callback, idToken, mockGoogleToken, startSignIn, validClaims } from '../support/google';
import { BASE, createRoom, postRoom } from '../support/rooms';

afterEach(() => vi.restoreAllMocks());

/** Signs in through Google from `returnOrigin`, returning where the callback sends the browser. */
async function signInFrom(returnOrigin: string): Promise<string | null> {
  mockGoogleToken(() => Response.json({ id_token: idToken(validClaims()), access_token: 'x' }));
  const { params, oauthCookie } = await startSignIn('/r/abc', returnOrigin);
  const res = await callback({ code: 'c', state: params.get('state') ?? '' }, oauthCookie);
  return res.headers.get('Location');
}

describe('Acrosticle, as one of two sites', () => {
  it('signs people in for Crosswordicle and sends them back there', async () => {
    expect(await signInFrom('https://crosswordicle.test')).toBe('https://crosswordicle.test/r/abc');
  });

  it("won't send people back to a site that isn't ours", async () => {
    expect(await signInFrom('https://evil.test')).toBe(`${BASE}/r/abc`);
  });

  it('only creates rooms for acrostics', async () => {
    const { cookie } = await signInAs();
    const res = await postRoom({ puzzle: miniCrosswordFile }, cookie);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: 'This site is for acrostics; that puzzle is a crossword.',
    });
    expect((await postRoom({ sample: 'gridicles-mini-1' }, cookie)).status).toBe(400);
  });

  it('lists rooms from both sites in My puzzles, each linking to its own site', async () => {
    const { cookie, userId } = await signInAs('ada@example.com', 'Ada');
    const acrostic = await createRoom();
    // A room made on the crossword site, as that site records it in the shared database.
    const crossword = 'CrosswordRoomForMyList';
    const now = Date.now();
    await env.DB.prepare(
      "INSERT INTO rooms (room_id, kind, created_by, title, created_at, updated_at) VALUES (?, 'crossword', ?, 'Mini', ?, ?)",
    )
      .bind(crossword, userId, now, now)
      .run();

    const res = await exports.default.fetch(`${BASE}/api/me/rooms`, {
      headers: { Cookie: cookie },
    });
    const { rooms } = await res.json<MyRoomsResponse>();
    expect(rooms.find((room) => room.roomId === acrostic)).toMatchObject({
      kind: 'acrostic',
      url: `${BASE}/r/${acrostic}`,
    });
    expect(rooms.find((room) => room.roomId === crossword)).toMatchObject({
      kind: 'crossword',
      url: `https://crosswordicle.test/r/${crossword}`,
    });
  });
});
