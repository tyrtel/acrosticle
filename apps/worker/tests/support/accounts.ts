import { env } from 'cloudflare:workers';
import { SESSION_COOKIE } from '../../src/auth';
import { createSession, upsertGoogleUser } from '../../src/db';

/** Creates an account and session directly, returning the Cookie header to use. */
export async function signInAs(email = 'ada@example.com', name = 'Ada') {
  const now = Date.now();
  const userId = await upsertGoogleUser(
    env.DB,
    { sub: `sub-${email}`, email, name, picture: null },
    now,
  );
  const token = await createSession(env.DB, userId, now);
  return { userId, token, cookie: `${SESSION_COOKIE}=${token}` };
}
