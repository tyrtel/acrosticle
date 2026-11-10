/**
 * Builds and deploys Acrosticle to Cloudflare, then smoke-tests the live site.
 *
 *   npm run deploy                 # code only (secrets already on Cloudflare)
 *   npm run deploy -- --secrets    # also upload GOOGLE_CLIENT_SECRET and CREATOR_ALLOWLIST
 *                                  # from apps/worker/.dev.vars (needed on the first deploy)
 *
 * Secrets go to Wrangler through a temporary file readable only by you, which
 * is deleted afterwards. They are never printed.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { configProblems, deploySecrets } from './lib/deployConfig.ts';

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
function run(command: string, args: string[], cwd = ROOT): void {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit' });
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

  try {
    step('Building the web app');
    run('npm', ['run', 'build', '-w', '@acrosticle/web']);

    step('Applying database migrations to production');
    run('npx', ['wrangler', 'd1', 'migrations', 'apply', 'acrosticle', '--remote'], WORKER);

    step('Deploying the Worker');
    run(
      'npx',
      ['wrangler', 'deploy', ...(secretsFile ? ['--secrets-file', secretsFile] : [])],
      WORKER,
    );
  } finally {
    if (secretsDir) rmSync(secretsDir, { recursive: true, force: true });
  }

  step('Smoke-testing the live site');
  run('node', ['scripts/smoke.ts']);
}

main();
