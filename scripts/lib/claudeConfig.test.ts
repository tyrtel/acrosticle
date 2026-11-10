import { describe, expect, it } from 'vitest';
import { checkAnthropicKey } from './claudeConfig.ts';

describe('checkAnthropicKey', () => {
  it.each([
    [`sk-ant-api03-${'x'.repeat(60)}`, true],
    ['', false],
    ['sk-ant-short', false],
    [`sk-proj-${'x'.repeat(60)}`, false],
    [`sk-ant-api03 ${'x'.repeat(60)}`, false],
  ])('%#', (value, ok) => {
    expect(checkAnthropicKey(value).ok).toBe(ok);
  });
});
