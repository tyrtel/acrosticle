import type { ParsePuzzleResponse } from '@acrosticle/protocol';
import { env, exports } from 'cloudflare:workers';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parsePuzzle, PARSES_PER_HOUR, parseSettings } from '../../src/parsing';
import { signInAs } from '../support/accounts';
import { mockClaude, tinyExtraction } from '../support/claude';
import { BASE } from '../support/rooms';

afterEach(() => vi.restoreAllMocks());
// Limits count past runs: start each test with none (the database isn't reset between tests).
beforeEach(async () => {
  await env.DB.prepare('DELETE FROM parse_runs').run();
});

// Allowlisted test creators are shared across tests; the database isn't reset between them.
const creator = () => signInAs('bo@example.com', 'Bo');

function upload(cookie?: string, file: File | string | null = jpeg()) {
  const form = new FormData();
  if (file !== null) form.set('image', file);
  return exports.default.fetch(`${BASE}/api/puzzles/parse`, {
    method: 'POST',
    headers: { Origin: BASE, ...(cookie ? { Cookie: cookie } : {}) },
    body: form,
  });
}

function jpeg(bytes = 64, type = 'image/jpeg') {
  return new File([new Uint8Array(bytes).fill(7)], 'puzzle.jpg', { type });
}

const runsFor = async (userId: string) =>
  (
    await env.DB.prepare('SELECT outcome, cost_usd FROM parse_runs WHERE user_id = ? ORDER BY id')
      .bind(userId)
      .all<{ outcome: string; cost_usd: number }>()
  ).results;

describe('POST /api/puzzles/parse', () => {
  it('reads an image into a draft puzzle, sending the image to Claude', async () => {
    const { cookie, userId } = await creator();
    const bodies = mockClaude({
      text: JSON.stringify(tinyExtraction),
      inputTokens: 6000,
      outputTokens: 4000,
    });

    const res = await upload(cookie);
    expect(res.status).toBe(200);
    const body = await res.json<ParsePuzzleResponse>();
    expect(body.file).toMatchObject({ title: 'Tiny', grid: { columns: 4 } });
    expect(body.notes).toEqual(['Square 5 was faint.']);
    expect(body.needsFixes).toBe(false);
    expect(body.costUsd).toBeCloseTo(0.104);

    const sent = bodies[0] as {
      model: string;
      messages: { content: { type: string; source?: { data: string; media_type: string } }[] }[];
    };
    expect(sent.model).toBe(env.PARSE_MODEL); // whatever wrangler.jsonc configures
    expect(sent.messages[0]?.content[0]).toMatchObject({
      type: 'image',
      source: {
        media_type: 'image/jpeg',
        data: btoa(String.fromCharCode(...new Uint8Array(64).fill(7))),
      },
    });
    expect((await runsFor(userId)).at(-1)).toMatchObject({ outcome: 'ok' });
  });

  it('uses the model and effort from Worker settings', async () => {
    expect(parseSettings({ ...env, PARSE_MODEL: 'claude-haiku-5-5', PARSE_EFFORT: 'low' })).toEqual(
      {
        model: 'claude-haiku-5-5',
        effort: 'low',
      },
    );
    expect(parseSettings({ ...env, PARSE_MODEL: '', PARSE_EFFORT: 'bogus' })).toEqual({
      model: 'claude-opus-5-5',
      effort: 'high',
    });

    const { cookie } = await creator();
    const bodies = mockClaude({ text: JSON.stringify(tinyExtraction) });
    await upload(cookie);
    expect(bodies[0]).toMatchObject({
      model: env.PARSE_MODEL,
      output_config: { effort: env.PARSE_EFFORT },
    });
  });

  it('returns a misprinted draft with its issues, for review', async () => {
    const { cookie } = await creator();
    mockClaude({ text: JSON.stringify({ ...tinyExtraction, rows: ['1A 2A # 3A', '4B # 5A'] }) });
    const body = await (await upload(cookie)).json<ParsePuzzleResponse>();
    expect(body.needsFixes).toBe(true);
    expect(body.issues.map((i) => i.code)).toEqual(['label-mismatch']);
  });

  it.each([
    ['a refusal', { stopReason: 'refusal' }, 422, 'refusal'],
    ['unreadable output', { text: 'no puzzle here' }, 422, 'unreadable'],
    ['an Anthropic outage', { status: 529 }, 502, 'api-error'],
  ])('explains %s and records it', async (_label, reply, status, outcome) => {
    const { cookie, userId } = await creator();
    mockClaude(reply);
    const res = await upload(cookie);
    expect(res.status).toBe(status);
    expect((await res.json<{ error: string }>()).error).toBeTruthy();
    expect((await runsFor(userId)).at(-1)?.outcome).toBe(outcome);
  });

  it('requires sign-in and an allowlisted account', async () => {
    expect((await upload()).status).toBe(401);
    const stranger = await signInAs(`x-${crypto.randomUUID()}@example.com`, 'X');
    expect((await upload(stranger.cookie)).status).toBe(403);
  });

  it.each([
    ['no file', null, 400],
    ['a text field', 'not a file', 400],
    ['a PDF', jpeg(64, 'application/pdf'), 415],
    ['an empty image', jpeg(0), 400],
  ])('rejects %s', async (_label, file, status) => {
    const { cookie } = await creator();
    expect((await upload(cookie, file)).status).toBe(status);
  });

  it('rejects images over 10 MB', async () => {
    const { cookie } = await creator();
    expect((await upload(cookie, jpeg(10 * 1024 * 1024 + 1))).status).toBe(413);
  });

  it('answers 503 when no Anthropic key is configured', async () => {
    const { cookie } = await creator();
    const request = new Request(`${BASE}/api/puzzles/parse`, {
      method: 'POST',
      headers: { Cookie: cookie },
      body: new FormData(),
    });
    const res = await parsePuzzle(request, { ...env, ANTHROPIC_API_KEY: '' } as Env);
    expect(res.status).toBe(503);
  });

  it(`limits each person to ${PARSES_PER_HOUR} parses an hour`, async () => {
    const { cookie, userId } = await creator();
    const now = Date.now();
    for (let i = 0; i < PARSES_PER_HOUR; i++) {
      await env.DB.prepare('INSERT INTO parse_runs (user_id, created_at, outcome) VALUES (?, ?, ?)')
        .bind(userId, now - i * 1000, 'ok')
        .run();
    }
    const bodies = mockClaude({ text: JSON.stringify(tinyExtraction) });
    const res = await upload(cookie);
    expect(res.status).toBe(429);
    expect((await res.json<{ error: string }>()).error).toMatch(/in the last hour/);
    expect(bodies).toHaveLength(0); // Claude was never called
  });

  it("stops when today's budget is used up", async () => {
    const { cookie } = await creator();
    const other = await signInAs(`spender-${crypto.randomUUID()}@example.com`, 'S');
    await env.DB.prepare(
      'INSERT INTO parse_runs (user_id, created_at, outcome, cost_usd) VALUES (?, ?, ?, ?)',
    )
      .bind(other.userId, Date.now(), 'ok', Number(env.PARSE_DAILY_BUDGET_USD))
      .run();
    const bodies = mockClaude({ text: JSON.stringify(tinyExtraction) });
    const res = await upload(cookie);
    expect(res.status).toBe(429);
    expect((await res.json<{ error: string }>()).error).toMatch(/budget/);
    expect(bodies).toHaveLength(0);
  });
});
