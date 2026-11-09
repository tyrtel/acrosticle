import type { MeResponse, MyRoomsResponse, SignInResult } from '@acrosticle/protocol';
import { appOrigin, canCreate, SESSION_COOKIE, signInConfigured } from './auth';
import { clearCookie, readCookie, serializeCookie } from './cookies';
import {
  createSession,
  deleteSession,
  extendSession,
  EXTEND_BELOW_MS,
  findSession,
  listRoomsCreatedBy,
  SESSION_TTL_MS,
  upsertGoogleUser,
} from './db';
import { fromBase64Url, randomToken, toBase64Url } from './encoding';
import { authorizationUrl, createPkce, exchangeCode } from './google';

/** Holds the state, PKCE verifier and return path between leaving for Google and coming back. */
const OAUTH_COOKIE = 'acrosticle_oauth';
const OAUTH_COOKIE_PATH = '/api/auth';
const OAUTH_TTL_SECONDS = 600;
const SESSION_TTL_SECONDS = SESSION_TTL_MS / 1000;

interface PendingSignIn {
  readonly state: string;
  readonly verifier: string;
  readonly returnTo: string;
}

const callbackUrl = (origin: string) => `${origin}/api/auth/google/callback`;

/** `GET /api/auth/google`: sends the browser to Google's sign-in page. */
export async function startGoogleSignIn(request: Request, env: Env): Promise<Response> {
  const origin = appOrigin(request, env);
  if (!signInConfigured(env)) return redirect(withResult(`${origin}/`, 'unconfigured'));

  const returnTo = safeReturnPath(new URL(request.url).searchParams.get('returnTo'));
  const state = randomToken(16);
  const { verifier, challenge } = await createPkce();
  const pending: PendingSignIn = { state, verifier, returnTo };

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
  const origin = appOrigin(request, env);
  const params = new URL(request.url).searchParams;
  const pending = readPendingSignIn(request);
  const clearOauth = clearCookie(OAUTH_COOKIE, OAUTH_COOKIE_PATH);
  const backTo = pending?.returnTo ?? '/';
  const fail = (result: SignInResult) =>
    redirect(withResult(`${origin}${backTo}`, result), [clearOauth]);

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
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    redirectUri: callbackUrl(origin),
    now,
  });
  if (!outcome.ok) return fail(outcome.reason);

  const userId = await upsertGoogleUser(env.DB, outcome.identity, now);
  const token = await createSession(env.DB, userId, now);
  return redirect(`${origin}${pending.returnTo}`, [
    clearOauth,
    serializeCookie(SESSION_COOKIE, token, { maxAgeSeconds: SESSION_TTL_SECONDS }),
  ]);
}

/** `POST /api/auth/logout`: ends the session. */
export async function logout(request: Request, env: Env): Promise<Response> {
  const token = readCookie(request, SESSION_COOKIE);
  if (token) await deleteSession(env.DB, token);
  return new Response(null, {
    status: 204,
    headers: { 'Set-Cookie': clearCookie(SESSION_COOKIE) },
  });
}

/** `GET /api/me`: who is signed in. Also keeps an active session alive. */
export async function me(request: Request, env: Env): Promise<Response> {
  const token = readCookie(request, SESSION_COOKIE);
  const now = Date.now();
  const session = token ? await findSession(env.DB, token, now) : null;
  const headers = new Headers({ 'Cache-Control': 'no-store' });

  if (token && session && session.expiresAt - now < EXTEND_BELOW_MS) {
    await extendSession(env.DB, token, now);
    headers.append(
      'Set-Cookie',
      serializeCookie(SESSION_COOKIE, token, { maxAgeSeconds: SESSION_TTL_SECONDS }),
    );
  } else if (token && !session) {
    headers.append('Set-Cookie', clearCookie(SESSION_COOKIE));
  }

  const account = session?.account ?? null;
  const body: MeResponse = {
    user: account,
    canCreate: canCreate(account, env),
    signInConfigured: signInConfigured(env),
  };
  return Response.json(body, { headers });
}

/** `GET /api/me/rooms`: rooms the signed-in user created. */
export async function myRooms(request: Request, env: Env): Promise<Response> {
  const token = readCookie(request, SESSION_COOKIE);
  const session = token ? await findSession(env.DB, token, Date.now()) : null;
  if (!session) return Response.json({ error: 'Sign in to see your puzzles.' }, { status: 401 });
  const body: MyRoomsResponse = { rooms: await listRoomsCreatedBy(env.DB, session.account.id) };
  return Response.json(body, { headers: { 'Cache-Control': 'no-store' } });
}

/** Only same-site paths, so sign-in can't be used to bounce users to another site. */
export function safeReturnPath(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\'))
    return '/';
  return value;
}

function readPendingSignIn(request: Request): PendingSignIn | null {
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
