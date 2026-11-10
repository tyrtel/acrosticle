/**
 * Writes ANTHROPIC_API_KEY to apps/worker/.dev.vars for local image parsing.
 *
 *   npm run setup:claude
 *
 * The key is typed hidden and never printed. Get one at https://platform.claude.com
 * (API keys). Image parsing costs money per image: see docs/setup/claude-api.md.
 */
import { chmodSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { checkAnthropicKey } from './lib/claudeConfig.ts';
import { askHidden } from './lib/prompt.ts';
import { mask, parseDevVars, updateDevVars } from './lib/signinConfig.ts';

const ROOT = resolve(import.meta.dirname, '..');
// ACROSTICLE_DEV_VARS lets tests point at a scratch file instead of your real one.
const DEV_VARS = process.env.ACROSTICLE_DEV_VARS ?? resolve(ROOT, 'apps/worker/.dev.vars');
const EXAMPLE = resolve(ROOT, 'apps/worker/.dev.vars.example');

async function main(): Promise<void> {
  console.log('Local image parsing setup (Anthropic API key)\n');
  const existing = existsSync(DEV_VARS) ? readFileSync(DEV_VARS, 'utf8') : '';
  const current = parseDevVars(existing).get('ANTHROPIC_API_KEY');

  const typed = await askHidden(
    current ? `API key (hidden; Enter keeps ${mask(current)})` : 'API key (hidden)',
  );
  const key = typed || current || '';
  const check = checkAnthropicKey(key);
  if (!check.ok) {
    console.error(`\n✖ The API key ${check.problem}.`);
    process.exit(1);
  }

  const base = existing || (existsSync(EXAMPLE) ? readFileSync(EXAMPLE, 'utf8') : '');
  writeFileSync(DEV_VARS, updateDevVars(base, new Map([['ANTHROPIC_API_KEY', key]])), {
    mode: 0o600,
  });
  chmodSync(DEV_VARS, 0o600);
  console.log(`\n✔ Saved ANTHROPIC_API_KEY (${mask(key)}) to apps/worker/.dev.vars`);
  console.log('\nNext: restart "npm run dev", then use "Upload a puzzle image" while signed in.');
  console.log('Each image costs roughly $0.30–$0.60 with the default settings.');
}

void main();
