import { readCookie } from './cookies';
import { findSession, type Account } from './db';

export const SESSION_COOKIE = 'acrosticle_session';

/** The signed-in account for a request, or null. */
export async function getCurrentUser(
  request: Request,
  env: Pick<Env, 'DB'>,
): Promise<Account | null> {
  const token = readCookie(request, SESSION_COOKIE);
  if (!token) return null;
  return (await findSession(env.DB, token, Date.now()))?.account ?? null;
}

/** Whether an account may create rooms for its own puzzles (verified email on the allowlist). */
export function canCreate(account: Account | null, env: Pick<Env, 'CREATOR_ALLOWLIST'>): boolean {
  if (!account) return false;
  // Secrets can be missing at runtime (e.g. no .dev.vars locally), whatever the types say.
  const allowed = (env.CREATOR_ALLOWLIST ?? '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(account.email.toLowerCase());
}

export function signInConfigured(
  env: Pick<Env, 'GOOGLE_CLIENT_ID' | 'GOOGLE_CLIENT_SECRET'>,
): boolean {
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
}

/** The address users see the app at; Google redirects back here. */
export function appOrigin(request: Request, env: Pick<Env, 'APP_ORIGIN'>): string {
  return env.APP_ORIGIN || new URL(request.url).origin;
}
