import { exports } from 'cloudflare:workers';
import { vi } from 'vitest';
import { toBase64Url } from '../../src/encoding';
import { GOOGLE_TOKEN_URL } from '../../src/google';
import { BASE } from './rooms';

const encode = (value: unknown) => toBase64Url(new TextEncoder().encode(JSON.stringify(value)));

/** An unsigned ID token with the given claims (our code reads claims only; see google.ts). */
export function idToken(claims: Record<string, unknown>): string {
  return `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode(claims)}.signature`;
}

export function validClaims(overrides: Record<string, unknown> = {}) {
  return {
    iss: 'https://accounts.google.com',
    aud: 'test-client-id',
    exp: Math.floor(Date.now() / 1000) + 3600,
    sub: 'google-ada',
    email: 'ada@example.com',
    email_verified: true,
    name: 'Ada Lovelace',
    picture: 'https://example.com/ada.png',
    ...overrides,
  };
}

/**
 * Replaces Google's token endpoint. The Worker under test shares this isolate,
 * so stubbing the global fetch intercepts its outbound calls. Returns the
 * request bodies Google received.
 */
export function mockGoogleToken(respond: (body: URLSearchParams) => Response) {
  const realFetch = globalThis.fetch;
  const bodies: URLSearchParams[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    if (url !== GOOGLE_TOKEN_URL) return realFetch(input, init);
    // Our code always sends the form as URLSearchParams.
    const body = init?.body instanceof URLSearchParams ? init.body : new URLSearchParams();
    bodies.push(body);
    return respond(body);
  });
  return bodies;
}

/** The value of a cookie in a response's Set-Cookie headers, and the full header. */
export function setCookie(res: Response, name: string) {
  const header = res.headers.getSetCookie().find((c) => c.startsWith(`${name}=`));
  return {
    header,
    value: header ? decodeURIComponent(header.slice(name.length + 1).split(';')[0] ?? '') : null,
  };
}

/** Starts sign-in like a browser would; returns Google's URL params and the state cookie. */
export async function startSignIn(returnTo?: string) {
  const query = returnTo === undefined ? '' : `?returnTo=${encodeURIComponent(returnTo)}`;
  // redirect: 'manual' so tests see our 302 instead of following it.
  const res = await exports.default.fetch(`${BASE}/api/auth/google${query}`, {
    redirect: 'manual',
  });
  const location = new URL(res.headers.get('Location') ?? '');
  const oauth = setCookie(res, 'acrosticle_oauth');
  return {
    res,
    location,
    params: location.searchParams,
    oauthCookie: `acrosticle_oauth=${oauth.value ?? ''}`,
    oauth,
  };
}

/** Comes back from Google to the callback with the given query and cookie. */
export function callback(query: Record<string, string>, cookie?: string): Promise<Response> {
  return exports.default.fetch(
    `${BASE}/api/auth/google/callback?${new URLSearchParams(query).toString()}`,
    {
      headers: cookie ? { Cookie: cookie } : {},
      redirect: 'manual',
    },
  );
}

/** The full happy path: returns the session cookie header to use. */
export async function signInThroughGoogle(claims = validClaims(), returnTo = '/') {
  mockGoogleToken(() => Response.json({ id_token: idToken(claims), access_token: 'x' }));
  const { params, oauthCookie } = await startSignIn(returnTo);
  const res = await callback({ code: 'auth-code', state: params.get('state') ?? '' }, oauthCookie);
  const session = setCookie(res, 'acrosticle_session');
  return { res, cookie: `acrosticle_session=${session.value ?? ''}` };
}
