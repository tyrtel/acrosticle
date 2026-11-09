/**
 * Shared logic for the local sign-in setup scripts: reading and writing
 * apps/worker/.dev.vars, and checking Google OAuth client values.
 * Pure functions only; the scripts do the I/O.
 */

export const LOCAL_CALLBACK = 'http://localhost:5173/api/auth/google/callback';
export const PRODUCTION_CALLBACK = 'https://acrosticle.tyrtel.workers.dev/api/auth/google/callback';

export const SIGNIN_KEYS = [
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'CREATOR_ALLOWLIST',
] as const;
export type SigninKey = (typeof SIGNIN_KEYS)[number];

/** Parses KEY=value lines (# comments and blank lines ignored; optional surrounding quotes removed). */
export function parseDevVars(text: string): Map<string, string> {
  const vars = new Map<string, string>();
  for (const line of text.split(/\r?\n/)) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (!match?.[1] || line.trimStart().startsWith('#')) continue;
    vars.set(match[1], (match[2] ?? '').replace(/^(['"])(.*)\1$/, '$2'));
  }
  return vars;
}

/**
 * Rewrites a .dev.vars file with new values, keeping comments, order and
 * unrelated keys. Keys not already present are appended.
 */
export function updateDevVars(text: string, updates: ReadonlyMap<string, string>): string {
  const pending = new Map(updates);
  const lines = text === '' ? [] : text.replace(/\r?\n$/, '').split(/\r?\n/);
  const updated = lines.map((line) => {
    const key = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/.exec(line)?.[1];
    if (!key || line.trimStart().startsWith('#') || !pending.has(key)) return line;
    const value = pending.get(key) ?? '';
    pending.delete(key);
    return `${key}=${value}`;
  });
  for (const [key, value] of pending) updated.push(`${key}=${value}`);
  return `${updated.join('\n')}\n`;
}

export type Check = { ok: true } | { ok: false; problem: string };

export function checkClientId(value: string): Check {
  if (!value) return { ok: false, problem: 'is empty' };
  if (/\s/.test(value)) return { ok: false, problem: 'contains spaces' };
  if (!value.endsWith('.apps.googleusercontent.com')) {
    return { ok: false, problem: 'should end with ".apps.googleusercontent.com"' };
  }
  return { ok: true };
}

export function checkClientSecret(value: string): Check {
  if (!value) return { ok: false, problem: 'is empty' };
  if (/\s/.test(value)) return { ok: false, problem: 'contains spaces' };
  if (value.length < 20) return { ok: false, problem: 'looks too short to be a client secret' };
  return { ok: true };
}

/** Normalizes a comma- or space-separated email list, rejecting anything that isn't an email. */
export function parseAllowlist(value: string): { emails: string[]; invalid: string[] } {
  const items = value
    .split(/[\s,]+/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  const isEmail = (item: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(item);
  return {
    emails: [...new Set(items.filter(isEmail))],
    invalid: items.filter((item) => !isEmail(item)),
  };
}

export interface ClientJson {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly redirectUris: readonly string[];
}

/** Reads the client_secret_*.json file Google offers for download when you create a web client. */
export function readClientJson(text: string): ClientJson | { error: string } {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { error: "isn't valid JSON" };
  }
  const web = (data as { web?: Record<string, unknown> } | null)?.web;
  if (!web) return { error: 'has no "web" section. Is it a Web application client?' };
  const { client_id: clientId, client_secret: clientSecret, redirect_uris: uris } = web;
  if (typeof clientId !== 'string' || typeof clientSecret !== 'string') {
    return { error: 'is missing client_id or client_secret' };
  }
  const redirectUris = Array.isArray(uris)
    ? uris.filter((u): u is string => typeof u === 'string')
    : [];
  return { clientId, clientSecret, redirectUris };
}

/** Which of the app's callback URLs are missing from a client's redirect URIs. */
export function missingRedirectUris(registered: readonly string[]): string[] {
  return [LOCAL_CALLBACK, PRODUCTION_CALLBACK].filter((uri) => !registered.includes(uri));
}

/** Shows the start and end of a secret, e.g. "GOCS…x9Qa", for confirming without revealing it. */
export function mask(value: string): string {
  return value.length <= 8 ? '••••' : `${value.slice(0, 4)}…${value.slice(-4)}`;
}
