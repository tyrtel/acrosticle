import { describe, expect, it } from 'vitest';
import {
  configProblems,
  configValue,
  deploySecrets,
  PLACEHOLDER_DATABASE_ID,
} from './deployConfig.ts';

describe('deploySecrets', () => {
  it('picks only the deploy secrets', () => {
    const text = 'GOOGLE_CLIENT_ID=public\nGOOGLE_CLIENT_SECRET=shh\nCREATOR_ALLOWLIST=a@b.co\n';
    expect(deploySecrets(text)).toEqual({
      secrets: { GOOGLE_CLIENT_SECRET: 'shh', CREATOR_ALLOWLIST: 'a@b.co' },
      missing: [],
    });
  });

  it('includes the optional Anthropic key only when present', () => {
    const text = 'GOOGLE_CLIENT_SECRET=shh\nCREATOR_ALLOWLIST=a@b.co\nANTHROPIC_API_KEY=sk-ant-x\n';
    expect(deploySecrets(text).secrets).toEqual({
      GOOGLE_CLIENT_SECRET: 'shh',
      CREATOR_ALLOWLIST: 'a@b.co',
      ANTHROPIC_API_KEY: 'sk-ant-x',
    });
    expect(deploySecrets('ANTHROPIC_API_KEY=\n').secrets).toEqual({});
  });

  it('reports missing or empty secrets', () => {
    expect(deploySecrets('GOOGLE_CLIENT_SECRET=\n').missing).toEqual([
      'GOOGLE_CLIENT_SECRET',
      'CREATOR_ALLOWLIST',
    ]);
  });
});

describe('configValue / configProblems', () => {
  const config = (databaseId: string, clientId: string) =>
    `{ "vars": { "GOOGLE_CLIENT_ID": "${clientId}" }, "d1_databases": [{ "database_id": "${databaseId}" }] }`;

  it('reads values', () => {
    expect(configValue(config('abc', 'id'), 'database_id')).toBe('abc');
    expect(configValue('{}', 'database_id')).toBeNull();
  });

  it('flags the placeholder database id and an empty client id', () => {
    expect(configProblems(config(PLACEHOLDER_DATABASE_ID, ''))).toHaveLength(2);
    expect(configProblems(config('1234-real', 'x.apps.googleusercontent.com'))).toEqual([]);
  });
});
