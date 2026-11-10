import type { Check } from './signinConfig.ts';

/** Anthropic API keys look like "sk-ant-api03-…" (checked without calling the API). */
export function checkAnthropicKey(value: string): Check {
  if (!value) return { ok: false, problem: 'is empty' };
  if (/\s/.test(value)) return { ok: false, problem: 'contains spaces' };
  if (!value.startsWith('sk-ant-')) return { ok: false, problem: 'should start with "sk-ant-"' };
  if (value.length < 40) return { ok: false, problem: 'looks too short to be an API key' };
  return { ok: true };
}
