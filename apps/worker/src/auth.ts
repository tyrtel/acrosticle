export interface User {
  readonly id: string;
  readonly name: string;
}

const DEV_USER: User = { id: 'dev-user', name: 'Developer' };

/**
 * Resolves the signed-in user for a request, or null if nobody is signed in.
 *
 * TODO(M4): replace with Google sign-in sessions (design doc §7.4). Until then,
 * anonymous requests act as a development user only when DEV_ALLOW_ANONYMOUS
 * is "true", which `npm run dev` and the tests set. Deployed defaults deny.
 */
export function getCurrentUser(
  _request: Request,
  env: Pick<Env, 'DEV_ALLOW_ANONYMOUS'>,
): User | null {
  return env.DEV_ALLOW_ANONYMOUS === 'true' ? DEV_USER : null;
}
