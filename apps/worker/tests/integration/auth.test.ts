import { env, exports } from 'cloudflare:workers';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { sha256Hex } from '../../src/encoding';
import { codeChallenge } from '../../src/google';
import { route } from '../../src/router';
import { signInAs } from '../support/accounts';
import {
  callback,
  idToken,
  mockGoogleToken,
  setCookie,
  signInThroughGoogle,
  startSignIn,
  validClaims,
} from '../support/google';
import { BASE, postRoom, tinyPuzzleFile } from '../support/rooms';

afterEach(() => vi.restoreAllMocks());

async function setExpiry(token: string, expiresAt: number) {
  await env.DB.prepare('UPDATE sessions SET expires_at = ? WHERE token_hash = ?')
    .bind(expiresAt, await sha256Hex(token))
    .run();
}

async function expiryOf(token: string): Promise<number | null> {
  const row = await env.DB.prepare('SELECT expires_at FROM sessions WHERE token_hash = ?')
    .bind(await sha256Hex(token))
    .first<{ expires_at: number }>();
  return row?.expires_at ?? null;
}

const getMe = (cookie?: string) =>
  exports.default.fetch(`${BASE}/api/me`, { headers: cookie ? { Cookie: cookie } : {} });

describe('GET /api/auth/google', () => {
  it("redirects to Google's sign-in page with PKCE and state", async () => {
    const { res, location, params, oauth } = await startSignIn('/my');
    expect(res.status).toBe(302);
    expect(location.origin + location.pathname).toBe(
      'https://accounts.google.com/o/oauth2/v2/auth',
    );
    expect(params.get('client_id')).toBe('test-client-id');
    expect(params.get('redirect_uri')).toBe('https://acrosticle.test/api/auth/google/callback');
    expect(params.get('response_type')).toBe('code');
    expect(params.get('scope')).toBe('openid email profile');
    expect(params.get('code_challenge_method')).toBe('S256');
    expect(params.get('state')).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(oauth.header).toMatch(/HttpOnly; Secure; SameSite=Lax/);
    expect(oauth.header).toContain('Path=/api/auth');
    expect(oauth.header).toContain('Max-Age=600');
  });

  it('sends people back with a message when sign-in is not configured', async () => {
    const res = await route(new Request(`${BASE}/api/auth/google`), {
      ...env,
      GOOGLE_CLIENT_ID: '',
    });
    expect(res.headers.get('Location')).toBe('https://acrosticle.test/?signin=unconfigured');
  });
});

describe('GET /api/auth/google/callback', () => {
  it('signs the user in and returns them where they started', async () => {
    const bodies = mockGoogleToken(() => Response.json({ id_token: idToken(validClaims()) }));
    const { params, oauthCookie } = await startSignIn('/my');
    const res = await callback(
      { code: 'auth-code', state: params.get('state') ?? '' },
      oauthCookie,
    );

    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('https://acrosticle.test/my');
    const session = setCookie(res, 'acrosticle_session');
    expect(session.header).toMatch(/Max-Age=2592000; Path=\/; HttpOnly; Secure; SameSite=Lax/);
    expect(setCookie(res, 'acrosticle_oauth').header).toContain('Max-Age=0');

    // Google got the code, our secret, and a PKCE verifier matching the challenge.
    const [body] = bodies;
    expect(body?.get('code')).toBe('auth-code');
    expect(body?.get('client_secret')).toBe('test-client-secret');
    expect(body?.get('redirect_uri')).toBe('https://acrosticle.test/api/auth/google/callback');
    expect(await codeChallenge(body?.get('code_verifier') ?? '')).toBe(
      params.get('code_challenge'),
    );

    const me = await getMe(`acrosticle_session=${session.value ?? ''}`);
    expect(await me.json()).toMatchObject({
      user: {
        name: 'Ada Lovelace',
        email: 'ada@example.com',
        picture: 'https://example.com/ada.png',
      },
      canCreate: true,
      signInConfigured: true,
    });
  });

  it('updates the same account on the next sign-in', async () => {
    await signInThroughGoogle();
    vi.restoreAllMocks();
    await signInThroughGoogle(validClaims({ name: 'Countess Lovelace' }));
    const users = await env.DB.prepare(
      "SELECT name FROM users WHERE google_sub = 'google-ada'",
    ).all<{ name: string }>();
    expect(users.results).toEqual([{ name: 'Countess Lovelace' }]);
  });

  it('rejects a state that does not match, without calling Google', async () => {
    const bodies = mockGoogleToken(() => Response.json({ id_token: idToken(validClaims()) }));
    const { oauthCookie } = await startSignIn('/my');
    const res = await callback({ code: 'auth-code', state: 'forged' }, oauthCookie);
    expect(res.headers.get('Location')).toBe('https://acrosticle.test/my?signin=failed');
    expect(bodies).toHaveLength(0);
    expect(setCookie(res, 'acrosticle_session').header).toBeUndefined();
  });

  it('fails when the state cookie is missing or expired', async () => {
    const { params } = await startSignIn();
    const res = await callback({ code: 'auth-code', state: params.get('state') ?? '' });
    expect(res.headers.get('Location')).toBe('https://acrosticle.test/?signin=failed');
  });

  it('treats a tampered state cookie as missing', async () => {
    const res = await callback({ code: 'c', state: 's' }, 'acrosticle_oauth=not-base64-json');
    expect(res.headers.get('Location')).toBe('https://acrosticle.test/?signin=failed');
  });

  it('reports a cancelled sign-in', async () => {
    const { oauthCookie } = await startSignIn('/r/abc');
    const res = await callback({ error: 'access_denied' }, oauthCookie);
    expect(res.headers.get('Location')).toBe('https://acrosticle.test/r/abc?signin=cancelled');
  });

  it('reports other errors from Google', async () => {
    const { oauthCookie } = await startSignIn();
    const res = await callback({ error: 'server_error' }, oauthCookie);
    expect(res.headers.get('Location')).toBe('https://acrosticle.test/?signin=failed');
  });

  it('fails when the code exchange fails', async () => {
    mockGoogleToken(() => Response.json({ error: 'invalid_grant' }, { status: 400 }));
    const { params, oauthCookie } = await startSignIn();
    const res = await callback({ code: 'bad', state: params.get('state') ?? '' }, oauthCookie);
    expect(res.headers.get('Location')).toBe('https://acrosticle.test/?signin=failed');
  });

  it('refuses accounts whose email Google has not verified', async () => {
    const { res, cookie } = await signInThroughGoogle(validClaims({ email_verified: false }));
    expect(res.headers.get('Location')).toBe('https://acrosticle.test/?signin=unverified');
    expect(cookie).toBe('acrosticle_session=');
  });

  it('only returns to same-site paths', async () => {
    const { res } = await signInThroughGoogle(validClaims(), '//evil.example/steal');
    expect(res.headers.get('Location')).toBe('https://acrosticle.test/');
  });
});

describe('GET /api/me', () => {
  it('reports a signed-out visitor', async () => {
    expect(await (await getMe()).json()).toEqual({
      user: null,
      canCreate: false,
      signInConfigured: true,
    });
  });

  it('says whether the user may create puzzles', async () => {
    const cy = await signInAs('cy@example.com', 'Cy');
    expect(await (await getMe(cy.cookie)).json()).toMatchObject({
      user: { name: 'Cy' },
      canCreate: false,
    });
  });

  it('reports when sign-in is not configured', async () => {
    const res = await route(new Request(`${BASE}/api/me`), { ...env, GOOGLE_CLIENT_SECRET: '' });
    expect(await res.json()).toMatchObject({ signInConfigured: false });
  });

  it('forgets expired sessions and clears the cookie', async () => {
    const { cookie, token } = await signInAs();
    await setExpiry(token, Date.now() - 1);
    const res = await getMe(cookie);
    expect(await res.json()).toMatchObject({ user: null });
    expect(setCookie(res, 'acrosticle_session').header).toContain('Max-Age=0');
    expect(await expiryOf(token)).toBeNull();
  });

  it('extends a session that is past its halfway point, and leaves fresh ones alone', async () => {
    const { cookie, token } = await signInAs();
    const fresh = await getMe(cookie);
    expect(setCookie(fresh, 'acrosticle_session').header).toBeUndefined();

    await setExpiry(token, Date.now() + 5 * 86_400_000);
    const res = await getMe(cookie);
    expect(setCookie(res, 'acrosticle_session').header).toContain('Max-Age=2592000');
    expect(await expiryOf(token)).toBeGreaterThan(Date.now() + 29 * 86_400_000);
  });
});

describe('POST /api/auth/logout', () => {
  it('ends the session', async () => {
    const { cookie } = await signInAs();
    const res = await exports.default.fetch(`${BASE}/api/auth/logout`, {
      method: 'POST',
      headers: { Cookie: cookie },
    });
    expect(res.status).toBe(204);
    expect(setCookie(res, 'acrosticle_session').header).toContain('Max-Age=0');
    expect(await (await getMe(cookie)).json()).toMatchObject({ user: null });
  });

  it('is harmless when not signed in', async () => {
    const res = await exports.default.fetch(`${BASE}/api/auth/logout`, { method: 'POST' });
    expect(res.status).toBe(204);
  });
});

describe('GET /api/me/rooms', () => {
  const getRooms = (cookie?: string) =>
    exports.default.fetch(`${BASE}/api/me/rooms`, { headers: cookie ? { Cookie: cookie } : {} });

  it('requires sign-in', async () => {
    expect((await getRooms()).status).toBe(401);
  });

  it("lists the user's own rooms, newest first", async () => {
    const ada = await signInAs('ada@example.com');
    const bo = await signInAs('bo@example.com', 'Bo');
    const first = await (
      await postRoom({ puzzle: tinyPuzzleFile }, ada.cookie)
    ).json<{ roomId: string }>();
    await new Promise((resolve) => setTimeout(resolve, 5));
    const second = await (
      await postRoom({ sample: 'diplo-crostic-37' }, ada.cookie)
    ).json<{ roomId: string }>();
    await postRoom({ puzzle: tinyPuzzleFile }, bo.cookie);
    await postRoom({ sample: 'diplo-crostic-37' });

    const { rooms } = await (
      await getRooms(ada.cookie)
    ).json<{ rooms: { roomId: string; title: string }[] }>();
    expect(rooms.map((r) => [r.roomId, r.title])).toEqual([
      [second.roomId, 'Diplo-Crostic No. 37'],
      [first.roomId, 'Tiny'],
    ]);
  });
});
