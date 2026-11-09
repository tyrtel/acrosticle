/**
 * Checks the local Google sign-in setup and explains anything that's off.
 *
 *   npm run doctor:signin
 *
 * Run it with `npm run dev` going to also check what the app sends to Google.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  checkClientId,
  checkClientSecret,
  LOCAL_CALLBACK,
  mask,
  parseAllowlist,
  parseDevVars,
} from './lib/signinConfig.ts';

const ROOT = resolve(import.meta.dirname, '..');
// ACROSTICLE_DEV_VARS lets tests point at a scratch file instead of your real one.
const DEV_VARS = process.env.ACROSTICLE_DEV_VARS ?? resolve(ROOT, 'apps/worker/.dev.vars');
// ACROSTICLE_APP_URL lets tests check a dev server on another port.
const APP = process.env.ACROSTICLE_APP_URL ?? 'http://localhost:5173';

let problems = 0;
const pass = (message: string) => console.log(`  ✔ ${message}`);
const warn = (message: string) => console.log(`  ⚠ ${message}`);
const problem = (message: string, fix?: string) => {
  problems += 1;
  console.log(`  ✖ ${message}`);
  if (fix) console.log(`      → ${fix}`);
};

function checkFile(): Map<string, string> | null {
  console.log('Secrets file (apps/worker/.dev.vars)');
  if (!existsSync(DEV_VARS)) {
    problem("doesn't exist yet", 'run: npm run setup:signin');
    return null;
  }
  pass('exists');

  try {
    execFileSync('git', ['check-ignore', '-q', DEV_VARS], { cwd: ROOT });
    pass('is ignored by git (it will never be committed)');
  } catch {
    problem('is NOT ignored by git', 'make sure .gitignore contains ".dev.vars"');
  }

  if (process.platform !== 'win32' && (statSync(DEV_VARS).mode & 0o077) !== 0) {
    warn(
      'is readable by other users on this machine (optional fix: chmod 600 apps/worker/.dev.vars)',
    );
  }

  const vars = parseDevVars(readFileSync(DEV_VARS, 'utf8'));
  const id = vars.get('GOOGLE_CLIENT_ID') ?? '';
  const secret = vars.get('GOOGLE_CLIENT_SECRET') ?? '';
  const idCheck = checkClientId(id);
  if (idCheck.ok) pass(`GOOGLE_CLIENT_ID is ${id}`);
  else problem(`GOOGLE_CLIENT_ID ${idCheck.problem}`, 'run: npm run setup:signin');
  const secretCheck = checkClientSecret(secret);
  if (secretCheck.ok) pass(`GOOGLE_CLIENT_SECRET is set (${mask(secret)})`);
  else problem(`GOOGLE_CLIENT_SECRET ${secretCheck.problem}`, 'run: npm run setup:signin');

  const { emails, invalid } = parseAllowlist(vars.get('CREATOR_ALLOWLIST') ?? '');
  if (invalid.length > 0) problem(`CREATOR_ALLOWLIST has non-emails: ${invalid.join(', ')}`);
  if (emails.length > 0) pass(`CREATOR_ALLOWLIST: ${emails.join(', ')}`);
  else
    problem(
      'CREATOR_ALLOWLIST is empty, so nobody can create puzzles',
      'run: npm run setup:signin',
    );
  return vars;
}

async function checkRunningApp(vars: Map<string, string> | null): Promise<void> {
  console.log(`\nRunning app (${APP})`);
  let me: Response;
  try {
    me = await fetch(`${APP}/api/me`);
  } catch {
    warn('not running, so skipped these checks. Start it with "npm run dev" and run this again.');
    return;
  }
  if (!me.ok) {
    problem(`/api/me answered ${me.status}`, 'is the Worker running? Check the dev server output');
    return;
  }
  const status = (await me.json()) as { signInConfigured?: boolean };
  if (status.signInConfigured) pass('the Worker has the Google credentials');
  else {
    problem(
      "the Worker doesn't see the Google credentials",
      'restart "npm run dev" after editing .dev.vars (it only reads the file at startup)',
    );
    return;
  }

  const start = await fetch(`${APP}/api/auth/google`, { redirect: 'manual' });
  const location = start.headers.get('location') ?? '';
  if (!location.startsWith('https://accounts.google.com/')) {
    problem(`sign-in didn't redirect to Google (got ${start.status} ${location || 'no redirect'})`);
    return;
  }
  const params = new URL(location).searchParams;
  pass('"Sign in with Google" redirects to Google');

  const redirectUri = params.get('redirect_uri');
  if (redirectUri === LOCAL_CALLBACK) pass(`redirect URI sent to Google: ${redirectUri}`);
  else
    problem(
      `redirect URI sent to Google is ${redirectUri ?? '(none)'}, expected ${LOCAL_CALLBACK}`,
    );

  const sentId = params.get('client_id');
  const expectedId = vars?.get('GOOGLE_CLIENT_ID');
  if (sentId && sentId === expectedId) pass('client ID sent to Google matches .dev.vars');
  else problem(`client ID sent to Google (${sentId ?? 'none'}) doesn't match .dev.vars`);

  const scopes = (params.get('scope') ?? '').split(' ').sort().join(' ');
  if (scopes === 'email openid profile') pass('asks only for openid, email and profile');
  else warn(`unexpected scopes: ${scopes}`);
}

async function main(): Promise<void> {
  console.log('Checking local Google sign-in setup\n');
  const vars = checkFile();
  await checkRunningApp(vars);

  console.log('');
  if (problems > 0) {
    console.log(`✖ ${problems} problem${problems === 1 ? '' : 's'} to fix (see → above).`);
    process.exit(1);
  }
  console.log('✔ Looks good. Open http://localhost:5173 and click "Sign in with Google".');
  console.log('  If Google shows "redirect_uri_mismatch", add this exact URI to the client in');
  console.log(
    `  Google Cloud (Clients → Acrosticle web), then wait a few minutes: ${LOCAL_CALLBACK}`,
  );
}

void main();
