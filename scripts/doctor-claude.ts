/**
 * Checks the local image-parsing setup without calling the API.
 *
 *   npm run doctor:claude
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { checkAnthropicKey } from './lib/claudeConfig.ts';
import { mask, parseDevVars } from './lib/signinConfig.ts';

const ROOT = resolve(import.meta.dirname, '..');
// ACROSTICLE_DEV_VARS lets tests point at a scratch file instead of your real one.
const DEV_VARS = process.env.ACROSTICLE_DEV_VARS ?? resolve(ROOT, 'apps/worker/.dev.vars');

console.log('Checking local image-parsing setup\n');
if (!existsSync(DEV_VARS)) {
  console.log('  ✖ apps/worker/.dev.vars does not exist\n      → run: npm run setup:claude');
  process.exit(1);
}
const key = parseDevVars(readFileSync(DEV_VARS, 'utf8')).get('ANTHROPIC_API_KEY') ?? '';
const check = checkAnthropicKey(key);
if (!check.ok) {
  console.log(`  ✖ ANTHROPIC_API_KEY ${check.problem}\n      → run: npm run setup:claude`);
  process.exit(1);
}
console.log(`  ✔ ANTHROPIC_API_KEY is set (${mask(key)})`);
console.log('\n✔ Looks good. Restart "npm run dev" if you just added it.');
console.log(
  '  Sign-in must work too (npm run doctor:signin): only allowlisted accounts can parse.',
);
