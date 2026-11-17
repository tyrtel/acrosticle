/**
 * Builds and deploys both sites to Cloudflare, then smoke-tests them: Acrosticle (acrostics)
 * and Crosswordicle (crosswords), one codebase deployed twice (see apps/worker/wrangler.jsonc).
 *
 *   npm run deploy                 # code only (secrets already on Cloudflare)
 *   npm run deploy -- --secrets    # also upload GOOGLE_CLIENT_SECRET and CREATOR_ALLOWLIST
 *                                  # from apps/worker/.dev.vars (needed on the first deploy)
 *
 * Crosswordicle needs only CREATOR_ALLOWLIST; if it's missing there (its first deploy), it's
 * copied from apps/worker/.dev.vars automatically.
 *
 * Secrets go to Wrangler through a temporary file readable only by you, which
 * is deleted afterwards. They are never printed.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  configProblems,
  CROSSWORD_SECRETS,
  deploySecrets,
  missingCrosswordSecrets,
} from './lib/deployConfig.ts';

const ROOT = resolve(import.meta.dirname, '..');
const WORKER = resolve(ROOT, 'apps/worker');
const DEV_VARS = resolve(WORKER, '.dev.vars');
const withSecrets = process.argv.includes('--secrets');

function step(title: string): void {
  console.log(`\n▶ ${title}`);
}

function fail(message: string): never {
  console.error(`\n✖ ${message}`);
  process.exit(1);
}

/** Runs a command with live output; stops the deploy if it fails. */
function run(command: string, args: string[], cwd = ROOT, env?: NodeJS.ProcessEnv): void {
  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    env: env ? { ...process.env, ...env } : process.env,
  });
  if (result.status !== 0) fail(`"${command} ${args.join(' ')}" failed.`);
}

function main(): void {
  step('Checking configuration');
  const problems = configProblems(readFileSync(resolve(WORKER, 'wrangler.jsonc'), 'utf8'));
  if (problems.length > 0) fail(problems.join('\n  '));
  try {
    execFileSync('npx', ['wrangler', 'whoami'], { cwd: WORKER, stdio: 'pipe' });
  } catch {
    fail('Wrangler is not logged in. Run: npx wrangler login');
  }
  const dirty = execFileSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8' });
  if (dirty.trim()) console.log('  ⚠ You have uncommitted changes; deploying them anyway.');
  console.log('  ✔ ready');

  let secretsDir: string | null = null;
  let secretsFile: string | null = null;
  if (withSecrets) {
    if (!existsSync(DEV_VARS))
      fail('No apps/worker/.dev.vars to read secrets from. Run: npm run setup:signin');
    const { secrets, missing } = deploySecrets(readFileSync(DEV_VARS, 'utf8'));
    if (missing.length > 0) fail(`apps/worker/.dev.vars is missing ${missing.join(', ')}.`);
    secretsDir = mkdtempSync(join(tmpdir(), 'acrosticle-secrets-'));
    secretsFile = join(secretsDir, 'secrets.json');
    writeFileSync(secretsFile, JSON.stringify(secrets), { mode: 0o600 });
    console.log(`  ✔ will upload ${Object.keys(secrets).join(' and ')} (values hidden)`);
  }

  const crosswordSecrets = crosswordSecretsToUpload();

  try {
    step('Building the web app (Acrosticle and Crosswordicle)');
    run('npm', ['run', 'build', '-w', '@gridicles/web']);
    run('npm', ['run', 'build', '-w', '@gridicles/web'], ROOT, { VITE_SITE: 'crossword' });

    step('Applying database migrations to production (shared by both sites)');
    run('npx', ['wrangler', 'd1', 'migrations', 'apply', 'acrosticle', '--remote'], WORKER);

    step('Deploying Acrosticle');
    run(
      'npx',
      ['wrangler', 'deploy', ...(secretsFile ? ['--secrets-file', secretsFile] : [])],
      WORKER,
    );

    step('Deploying Crosswordicle');
    const file = crosswordSecrets ? writeSecrets(crosswordSecrets) : null;
    try {
      run(
        'npx',
        [
          'wrangler',
          'deploy',
          '--env',
          'crossword',
          ...(file ? ['--secrets-file', file.path] : []),
        ],
        WORKER,
      );
    } finally {
      if (file) rmSync(file.dir, { recursive: true, force: true });
    }
  } finally {
    if (secretsDir) rmSync(secretsDir, { recursive: true, force: true });
  }

  step('Smoke-testing Acrosticle');
  run('node', ['scripts/smoke.ts']);
  step('Smoke-testing Crosswordicle');
  run('node', ['scripts/smoke.ts', 'https://crosswordicle.tyrtel.workers.dev', '--crossword']);
}

/**
 * Crosswordicle's secrets to upload: all of them with --secrets, else any it's missing (its
 * first deploy). Null if there's nothing to upload.
 */
function crosswordSecretsToUpload(): Record<string, string> | null {
  let needed: readonly string[] = CROSSWORD_SECRETS;
  if (!withSecrets) {
    let listed: string[] = [];
    try {
      const out = execFileSync(
        'npx',
        ['wrangler', 'secret', 'list', '--env', 'crossword', '--format', 'json'],
        { cwd: WORKER, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
      );
      listed = (JSON.parse(out) as { name: string }[]).map((secret) => secret.name);
    } catch {
      // No Crosswordicle Worker yet (first deploy): it needs everything.
    }
    needed = missingCrosswordSecrets(listed);
    if (needed.length === 0) return null;
  }
  if (!existsSync(DEV_VARS)) {
    fail(
      `Crosswordicle needs ${needed.join(', ')}, but there's no apps/worker/.dev.vars to copy it from.`,
    );
  }
  const vars = deploySecrets(readFileSync(DEV_VARS, 'utf8')).secrets;
  const secrets: Record<string, string> = {};
  for (const name of needed) {
    const value = vars[name];
    if (!value) fail(`apps/worker/.dev.vars is missing ${name}, which Crosswordicle needs.`);
    secrets[name] = value;
  }
  console.log(`  ✔ will give Crosswordicle ${needed.join(' and ')} (values hidden)`);
  return secrets;
}

/** Writes secrets to a file only you can read, for Wrangler; delete its directory afterwards. */
function writeSecrets(secrets: Record<string, string>): { dir: string; path: string } {
  const dir = mkdtempSync(join(tmpdir(), 'gridicles-secrets-'));
  const path = join(dir, 'secrets.json');
  writeFileSync(path, JSON.stringify(secrets), { mode: 0o600 });
  return { dir, path };
}

main();
