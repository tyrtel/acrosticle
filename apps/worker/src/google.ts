import { fromBase64Url, randomToken, sha256, toBase64Url } from './encoding';
import type { GoogleIdentity } from './db';

/**
 * Google sign-in: OAuth 2.0 authorization code flow with PKCE (RFC 7636),
 * scopes openid/email/profile. Written directly against Google's documented
 * endpoints rather than via a library: it's two HTTP calls, and owning them
 * keeps the dependency list short and the security checks visible.
 */
export const GOOGLE_AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
export const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_ISSUERS = new Set(['https://accounts.google.com', 'accounts.google.com']);

export interface Pkce {
  readonly verifier: string;
  readonly challenge: string;
}

export async function createPkce(): Promise<Pkce> {
  const verifier = randomToken(32);
  return { verifier, challenge: await codeChallenge(verifier) };
}

/** The S256 PKCE challenge for a verifier. */
export async function codeChallenge(verifier: string): Promise<string> {
  return toBase64Url(await sha256(verifier));
}

export function authorizationUrl(options: {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
}): string {
  const url = new URL(GOOGLE_AUTHORIZE_URL);
  url.search = new URLSearchParams({
    client_id: options.clientId,
    redirect_uri: options.redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state: options.state,
    code_challenge: options.codeChallenge,
    code_challenge_method: 'S256',
    prompt: 'select_account',
  }).toString();
  return url.toString();
}

export type SignInOutcome =
  | { readonly ok: true; readonly identity: GoogleIdentity }
  | { readonly ok: false; readonly reason: 'failed' | 'unverified' };

/** Exchanges an authorization code for the user's verified Google identity. */
export async function exchangeCode(options: {
  code: string;
  codeVerifier: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  now: number;
}): Promise<SignInOutcome> {
  let response: Response;
  try {
    response = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: options.code,
        code_verifier: options.codeVerifier,
        client_id: options.clientId,
        client_secret: options.clientSecret,
        redirect_uri: options.redirectUri,
      }),
    });
  } catch {
    return { ok: false, reason: 'failed' };
  }
  if (!response.ok) return { ok: false, reason: 'failed' };

  const body: unknown = await response.json().catch(() => null);
  const idToken = (body as { id_token?: unknown } | null)?.id_token;
  if (typeof idToken !== 'string') return { ok: false, reason: 'failed' };
  return readIdToken(idToken, options.clientId, options.now);
}

/**
 * Checks an ID token's claims and extracts the identity.
 *
 * The signature is deliberately not verified: this token comes straight from
 * Google's token endpoint over TLS in exchange for our client secret, and
 * OpenID Connect Core §3.1.3.7 allows TLS server validation in place of the
 * signature check for tokens received that way. Never pass tokens from any
 * other source (e.g. the browser) to this function.
 */
export function readIdToken(idToken: string, clientId: string, now: number): SignInOutcome {
  const payload = idToken.split('.')[1];
  if (!payload) return { ok: false, reason: 'failed' };
  let claims: Record<string, unknown>;
  try {
    claims = JSON.parse(new TextDecoder().decode(fromBase64Url(payload))) as Record<
      string,
      unknown
    >;
  } catch {
    return { ok: false, reason: 'failed' };
  }

  const audience = claims.aud;
  const audienceOk = Array.isArray(audience) ? audience.includes(clientId) : audience === clientId;
  const { iss, exp, sub, email } = claims;
  if (
    typeof iss !== 'string' ||
    !GOOGLE_ISSUERS.has(iss) ||
    !audienceOk ||
    typeof exp !== 'number' ||
    exp * 1000 <= now ||
    typeof sub !== 'string' ||
    typeof email !== 'string'
  ) {
    return { ok: false, reason: 'failed' };
  }
  if (claims.email_verified !== true) return { ok: false, reason: 'unverified' };

  const name =
    typeof claims.name === 'string' && claims.name.trim()
      ? claims.name.trim()
      : (email.split('@')[0] ?? email);
  const picture = typeof claims.picture === 'string' ? claims.picture : null;
  return { ok: true, identity: { sub, email, name, picture } };
}
