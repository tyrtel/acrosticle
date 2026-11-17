import type { PuzzleKind } from '@gridicles/protocol';

/**
 * Which site this Worker serves, and where the other one lives. Both sites
 * (Acrosticle for acrostics, Crosswordicle for crosswords) are this same code,
 * deployed twice with different settings (see wrangler.jsonc) and sharing one
 * database: one set of accounts, one My puzzles list, one sign-in.
 */
export interface Site {
  readonly kind: PuzzleKind;
  /** This site's address. */
  readonly origin: string;
  /** Each site's address, for links between them (e.g. in My puzzles). */
  readonly origins: Readonly<Record<PuzzleKind, string>>;
  /** Where Google sign-in happens: one site holds the Google callback for both. */
  readonly signInOrigin: string;
  /** Set the session cookie for this domain, so it covers both sites (unset: this host only). */
  readonly cookieDomain: string | undefined;
}

type SiteEnv = Pick<Env, 'APP_ORIGIN'> &
  Partial<
    Record<
      'SITE_KIND' | 'ACROSTIC_ORIGIN' | 'CROSSWORD_ORIGIN' | 'SIGN_IN_ORIGIN' | 'COOKIE_DOMAIN',
      string
    >
  >;

export function siteOf(request: Request, env: SiteEnv): Site {
  const origin = env.APP_ORIGIN || new URL(request.url).origin;
  const kind: PuzzleKind = env.SITE_KIND === 'crossword' ? 'crossword' : 'acrostic';
  const origins = {
    acrostic: env.ACROSTIC_ORIGIN || (kind === 'acrostic' ? origin : ''),
    crossword: env.CROSSWORD_ORIGIN || (kind === 'crossword' ? origin : ''),
  };
  return {
    kind,
    origin,
    origins,
    signInOrigin: env.SIGN_IN_ORIGIN || origin,
    cookieDomain: env.COOKIE_DOMAIN || undefined,
  };
}

/** Whether an address is one of our sites (safe to send people back to after sign-in). */
export function isSiteOrigin(site: Site, candidate: string): boolean {
  return candidate === site.origin || Object.values(site.origins).includes(candidate);
}
