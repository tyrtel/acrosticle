/** Pure helpers for the deploy script. */
import { parseDevVars } from './signinConfig.ts';

/** Secrets the production Worker needs, uploaded at deploy time. */
export const DEPLOY_SECRETS = ['GOOGLE_CLIENT_SECRET', 'CREATOR_ALLOWLIST'] as const;

export const PLACEHOLDER_DATABASE_ID = '00000000-0000-0000-0000-000000000000';

/** Picks the deploy secrets out of a .dev.vars file, reporting any that are missing or empty. */
export function deploySecrets(devVarsText: string): {
  secrets: Record<string, string>;
  missing: string[];
} {
  const vars = parseDevVars(devVarsText);
  const secrets: Record<string, string> = {};
  const missing: string[] = [];
  for (const key of DEPLOY_SECRETS) {
    const value = vars.get(key);
    if (value) secrets[key] = value;
    else missing.push(key);
  }
  return { secrets, missing };
}

/** Reads a string value from wrangler.jsonc text, e.g. "database_id". First match wins. */
export function configValue(wranglerText: string, key: string): string | null {
  const match = new RegExp(`"${key}"\\s*:\\s*"([^"]*)"`).exec(wranglerText);
  return match?.[1] ?? null;
}

/** Problems that would make a production deploy fail or misbehave. */
export function configProblems(wranglerText: string): string[] {
  const problems: string[] = [];
  const databaseId = configValue(wranglerText, 'database_id');
  if (!databaseId || databaseId === PLACEHOLDER_DATABASE_ID) {
    problems.push(
      'apps/worker/wrangler.jsonc still has the placeholder D1 database_id. Run "npx wrangler d1 create acrosticle" in apps/worker and paste the printed database_id.',
    );
  }
  if (!configValue(wranglerText, 'GOOGLE_CLIENT_ID')) {
    problems.push(
      'apps/worker/wrangler.jsonc has an empty GOOGLE_CLIENT_ID. Paste your public client ID there.',
    );
  }
  return problems;
}
