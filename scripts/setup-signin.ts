/**
 * Writes apps/worker/.dev.vars for local Google sign-in.
 *
 *   npm run setup:signin
 *   npm run setup:signin -- --from-json ~/Downloads/client_secret_XXXX.json
 *
 * Values are typed (or read from Google's download) on your machine only; the
 * secret is never echoed. The file is created readable only by you.
 */
import { existsSync, readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { stdin, stdout } from 'node:process';
import { createInterface } from 'node:readline/promises';
import {
  checkClientId,
  checkClientSecret,
  mask,
  missingRedirectUris,
  parseAllowlist,
  parseDevVars,
  readClientJson,
  updateDevVars,
} from './lib/signinConfig.ts';

const ROOT = resolve(import.meta.dirname, '..');
// ACROSTICLE_DEV_VARS lets tests point at a scratch file instead of your real one.
const DEV_VARS = process.env.ACROSTICLE_DEV_VARS ?? resolve(ROOT, 'apps/worker/.dev.vars');
const EXAMPLE = resolve(ROOT, 'apps/worker/.dev.vars.example');

async function ask(question: string, fallback = ''): Promise<string> {
  const hint = fallback ? ` [${fallback}]` : '';
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    const answer = (await rl.question(`${question}${hint}: `)).trim();
    return answer || fallback;
  } finally {
    rl.close();
  }
}

/**
 * Reads a line without showing it (for the client secret), handling
 * Backspace, Enter, Ctrl+C and pasted text. Falls back to a plain read when
 * input isn't a terminal (e.g. piped), where hiding isn't possible.
 */
async function askHidden(question: string): Promise<string> {
  if (!stdin.isTTY) return ask(question);
  stdout.write(`${question}: `);
  stdin.setRawMode(true);
  stdin.resume();
  return new Promise((resolvePromise) => {
    let value = '';
    const finish = () => {
      stdin.off('data', onData);
      stdin.setRawMode(false);
      stdin.pause();
      stdout.write('\n');
      resolvePromise(value.trim());
    };
    const onData = (chunk: Buffer) => {
      for (const ch of chunk.toString('utf8')) {
        if (ch === '\r' || ch === '\n') return finish();
        if (ch === '\u0003') {
          stdin.setRawMode(false);
          stdout.write('\n');
          process.exit(130);
        }
        if (ch === '\u007f' || ch === '\b') value = value.slice(0, -1);
        else if (ch >= ' ') value += ch;
      }
    };
    stdin.on('data', onData);
  });
}

function fail(message: string): never {
  console.error(`\n✖ ${message}`);
  process.exit(1);
}

async function main(): Promise<void> {
  console.log('Local Google sign-in setup for Acrosticle\n');

  const existing = existsSync(DEV_VARS) ? readFileSync(DEV_VARS, 'utf8') : '';
  const current = parseDevVars(existing);
  let clientId: string;
  let clientSecret: string;

  const jsonFlag = process.argv.indexOf('--from-json');
  if (jsonFlag !== -1) {
    const path = process.argv[jsonFlag + 1]?.replace(/^~(?=\/)/, homedir());
    if (!path || !existsSync(path)) fail(`Can't find the JSON file: ${path ?? '(none given)'}`);
    const client = readClientJson(readFileSync(path, 'utf8'));
    if ('error' in client) fail(`That JSON file ${client.error}.`);
    ({ clientId, clientSecret } = client);
    console.log(`Read client ${clientId} from ${path}`);
    const missing = missingRedirectUris(client.redirectUris);
    if (missing.length > 0) {
      console.warn('\n⚠ These redirect URIs are not on the client yet. Add them in Google Cloud');
      console.warn('  (Google Auth Platform → Clients → Acrosticle web), exactly as written:');
      for (const uri of missing) console.warn(`    ${uri}`);
      console.warn('');
    }
  } else {
    console.log('Find these in Google Cloud → Google Auth Platform → Clients → Acrosticle web.\n');
    clientId = await ask('Client ID', current.get('GOOGLE_CLIENT_ID') ?? '');
    const keep = current.get('GOOGLE_CLIENT_SECRET');
    clientSecret = await askHidden(
      keep ? `Client secret (hidden; Enter keeps ${mask(keep)})` : 'Client secret (hidden)',
    );
    clientSecret ||= keep ?? '';
  }

  const idCheck = checkClientId(clientId);
  if (!idCheck.ok) fail(`The client ID ${idCheck.problem}.`);
  const secretCheck = checkClientSecret(clientSecret);
  if (!secretCheck.ok) fail(`The client secret ${secretCheck.problem}.`);

  const allowlistAnswer = await ask(
    'Emails allowed to create puzzles (comma-separated)',
    current.get('CREATOR_ALLOWLIST') || 'tyrtel@gmail.com',
  );
  const { emails, invalid } = parseAllowlist(allowlistAnswer);
  if (invalid.length > 0) fail(`Not email addresses: ${invalid.join(', ')}`);
  if (emails.length === 0) fail('Add at least one email, or nobody can create puzzles.');

  const base = existing || (existsSync(EXAMPLE) ? readFileSync(EXAMPLE, 'utf8') : '');
  const updated = updateDevVars(
    base,
    new Map([
      ['GOOGLE_CLIENT_ID', clientId],
      ['GOOGLE_CLIENT_SECRET', clientSecret],
      ['CREATOR_ALLOWLIST', emails.join(',')],
    ]),
  );
  writeFileSync(DEV_VARS, updated, { mode: 0o600 });
  chmodSync(DEV_VARS, 0o600);

  console.log(`\n✔ Wrote apps/worker/.dev.vars (readable only by you; git ignores it)`);
  console.log(`    GOOGLE_CLIENT_ID     ${clientId}`);
  console.log(`    GOOGLE_CLIENT_SECRET ${mask(clientSecret)}`);
  console.log(`    CREATOR_ALLOWLIST    ${emails.join(', ')}`);
  console.log('\nNext:');
  console.log('  1. Restart the dev servers:  npm run dev');
  console.log('  2. In another terminal:      npm run doctor:signin');
  console.log('  3. Open http://localhost:5173 and click "Sign in with Google".');
}

main().catch((error: unknown) => fail(error instanceof Error ? error.message : String(error)));
