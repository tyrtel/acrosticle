import {
  roomPath,
  type MeResponse,
  type MyRoomsResponse,
  type SignInResult,
} from '@gridicles/protocol';
import { canCreate, canStartSample, SESSION_COOKIE, signInConfigured } from './auth';
import { clearCookie, readCookie, serializeCookie } from './cookies';
import {
  createSession,
  deleteSession,
  extendSession,
  EXTEND_BELOW_MS,
  findSession,
  listMyRooms,
  SESSION_TTL_MS,
  upsertGoogleUser,
} from './db';
import { fromBase64Url, randomToken, toBase64Url } from './encoding';
import { authorizationUrl, createPkce, exchangeCode } from './google';
import { isSiteOrigin, siteOf, type Site } from './sites';

/** Holds the state, PKCE verifier and return path between leaving for Google and coming back. */
const OAUTH_COOKIE = 'acrosticle_oauth';
const OAUTH_COOKIE_PATH = '/api/auth';
const OAUTH_TTL_SECONDS = 600;
const SESSION_TTL_SECONDS = SESSION_TTL_MS / 1000;

interface PendingSignIn {
  readonly state: string;
  readonly verifier: string;
  readonly returnTo: string;
  /** Which of our sites to go back to (sign-in for both happens on one; see sites.ts). */
  readonly returnOrigin: string;
}

const callbackUrl = (origin: string) => `${origin}/api/auth/google/callback`;

/** `GET /api/auth/google`: sends the browser to Google's sign-in page. */
export async function startGoogleSignIn(request: Request, env: Env): Promise<Response> {
  const site = siteOf(request, env);
  const origin = site.origin;
  const params = new URL(request.url).searchParams;
  const returnTo = safeReturnPath(params.get('returnTo'));

  // One site holds the Google callback for both: hand over, saying where to come back to.
  if (site.signInOrigin !== origin) {
    const handOff = new URL('/api/auth/google', site.signInOrigin);
    handOff.searchParams.set('returnTo', returnTo);
    handOff.searchParams.set('returnOrigin', origin);
    return redirect(handOff.toString());
  }
  if (!signInConfigured(env)) return redirect(withResult(`${origin}/`, 'unconfigured'));

  const requested = params.get('returnOrigin');
  const returnOrigin = requested && isSiteOrigin(site, requested) ? requested : origin;
  const state = randomToken(16);
  const { verifier, challenge } = await createPkce();
  const pending: PendingSignIn = { state, verifier, returnTo, returnOrigin };

  return redirect(
    authorizationUrl({
      clientId: env.GOOGLE_CLIENT_ID,
      redirectUri: callbackUrl(origin),
      state,
      codeChallenge: challenge,
    }),
    [
      serializeCookie(
        OAUTH_COOKIE,
        toBase64Url(new TextEncoder().encode(JSON.stringify(pending))),
        {
          maxAgeSeconds: OAUTH_TTL_SECONDS,
          path: OAUTH_COOKIE_PATH,
        },
      ),
    ],
  );
}

/** `GET /api/auth/google/callback`: Google sends the browser back here. */
export async function finishGoogleSignIn(request: Request, env: Env): Promise<Response> {
  const site = siteOf(request, env);
  const origin = site.origin;
  const params = new URL(request.url).searchParams;
  const pending = readPendingSignIn(request, site);
  const clearOauth = clearCookie(OAUTH_COOKIE, OAUTH_COOKIE_PATH);
  const backTo = `${pending?.returnOrigin ?? origin}${pending?.returnTo ?? '/'}`;
  const fail = (result: SignInResult) => redirect(withResult(backTo, result), [clearOauth]);

  if (params.get('error'))
    return fail(params.get('error') === 'access_denied' ? 'cancelled' : 'failed');
  const code = params.get('code');
  // The state must match the one we set in this browser: this stops an attacker
  // from logging the user into the attacker's account (login CSRF).
  if (!pending || !code || params.get('state') !== pending.state) return fail('failed');
  if (!signInConfigured(env)) return fail('unconfigured');

  const now = Date.now();
  const outcome = await exchangeCode({
    code,
    codeVerifier: pending.verifier,
    clientId: env.GOOGLE_CLIENT_ID,
    // Present: signInConfigured() checked it (only the site holding the callback has it).
    clientSecret: env.GOOGLE_CLIENT_SECRET ?? '',
    redirectUri: callbackUrl(origin),
    now,
  });
  if (!outcome.ok) return fail(outcome.reason);

  const userId = await upsertGoogleUser(env.DB, outcome.identity, now);
  const token = await createSession(env.DB, userId, now);
  return redirect(backTo, [clearOauth, sessionCookie(token, site)]);
}

/** `POST /api/auth/logout`: ends the session. */
export async function logout(request: Request, env: Env): Promise<Response> {
  const token = readCookie(request, SESSION_COOKIE);
  if (token) await deleteSession(env.DB, token);
  return new Response(null, {
    status: 204,
    headers: { 'Set-Cookie': clearCookie(SESSION_COOKIE, '/', siteOf(request, env).cookieDomain) },
  });
}

/** `GET /api/me`: who is signed in. Also keeps an active session alive. */
export async function me(request: Request, env: Env): Promise<Response> {
  const token = readCookie(request, SESSION_COOKIE);
  const now = Date.now();
  const session = token ? await findSession(env.DB, token, now) : null;
  const headers = new Headers({ 'Cache-Control': 'no-store' });

  const site = siteOf(request, env);
  if (token && session && session.expiresAt - now < EXTEND_BELOW_MS) {
    await extendSession(env.DB, token, now);
    headers.append('Set-Cookie', sessionCookie(token, site));
  } else if (token && !session) {
    headers.append('Set-Cookie', clearCookie(SESSION_COOKIE, '/', site.cookieDomain));
  }

  const account = session?.account ?? null;
  const body: MeResponse = {
    user: account,
    canCreate: canCreate(account, env),
    canStartSample: canStartSample(account, env),
    signInConfigured: signInConfigured(env),
  };
  return Response.json(body, { headers });
}

/** `GET /api/me/rooms`: rooms the signed-in user created. */
export async function myRooms(request: Request, env: Env): Promise<Response> {
  const token = readCookie(request, SESSION_COOKIE);
  const session = token ? await findSession(env.DB, token, Date.now()) : null;
  if (!session) return Response.json({ error: 'Sign in to see your puzzles.' }, { status: 401 });
  const { origins } = siteOf(request, env);
  const rooms = await listMyRooms(env.DB, session.account.id);
  const body: MyRoomsResponse = {
    rooms: rooms.map((room) => ({ ...room, url: `${origins[room.kind]}${roomPath(room.roomId)}` })),
  };
  return Response.json(body, { headers: { 'Cache-Control': 'no-store' } });
}

/** Only same-site paths, so sign-in can't be used to bounce users to another site. */
export function safeReturnPath(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\'))
    return '/';
  return value;
}

/** The session cookie, scoped to cover both sites when a cookie domain is set. */
function sessionCookie(token: string, site: Site): string {
  return serializeCookie(SESSION_COOKIE, token, {
    maxAgeSeconds: SESSION_TTL_SECONDS,
    domain: site.cookieDomain,
  });
}

function readPendingSignIn(request: Request, site: Site): PendingSignIn | null {
  const raw = readCookie(request, OAUTH_COOKIE);
  if (!raw) return null;
  try {
    const value = JSON.parse(
      new TextDecoder().decode(fromBase64Url(raw)),
    ) as Partial<PendingSignIn>;
    if (typeof value.state !== 'string' || typeof value.verifier !== 'string') return null;
    return {
      state: value.state,
      verifier: value.verifier,
      returnTo: safeReturnPath(value.returnTo ?? null),
      returnOrigin:
        typeof value.returnOrigin === 'string' && isSiteOrigin(site, value.returnOrigin)
          ? value.returnOrigin
          : site.origin,
    };
  } catch {
    return null;
  }
}

function withResult(url: string, result: SignInResult): string {
  return `${url}${url.includes('?') ? '&' : '?'}signin=${result}`;
}

function redirect(location: string, cookies: readonly string[] = []): Response {
  const headers = new Headers({ Location: location, 'Cache-Control': 'no-store' });
  for (const cookie of cookies) headers.append('Set-Cookie', cookie);
  return new Response(null, { status: 302, headers });
}
