import type { TidyCluesResponse } from '@gridicles/protocol';
import { env, exports } from 'cloudflare:workers';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PARSES_PER_HOUR } from '../../src/parsing';
import { signInAs } from '../support/accounts';
import { mockClaude } from '../support/claude';
import { BASE } from '../support/rooms';

afterEach(() => vi.restoreAllMocks());
beforeEach(async () => {
  await env.DB.prepare('DELETE FROM parse_runs').run();
});

const creator = () => signInAs('bo@example.com', 'Bo');
const tidied = {
  across: [{ number: 1, text: 'Fuel at the pump' }],
  down: [{ number: 1, text: 'Laughing ___' }],
  notes: ['Guessed that 1 Laughing ___ is Down.'],
};

function tidy(
  cookie: string | undefined,
  body: unknown = { text: 'ACROS 1 Fuel at the pump 1 Laughing ___' },
) {
  return exports.default.fetch(`${BASE}/api/crosswords/clues`, {
    method: 'POST',
    headers: {
      Origin: BASE,
      'Content-Type': 'application/json',
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify(body),
  });
}

describe('POST /api/crosswords/clues', () => {
  it('sorts pasted text into clues with Claude, at low effort, and logs the run', async () => {
    const { cookie, userId } = await creator();
    const bodies = mockClaude({
      text: JSON.stringify(tidied),
      inputTokens: 900,
      outputTokens: 300,
    });
    const res = await tidy(cookie);
    expect(res.status).toBe(200);
    const body = await res.json<TidyCluesResponse>();
    expect(body.clues).toEqual({ across: tidied.across, down: tidied.down });
    expect(body.notes).toEqual(tidied.notes);

    const sent = bodies[0] as {
      model: string;
      output_config: { effort: string };
      messages: unknown;
    };
    expect(sent.model).toBe(env.PARSE_MODEL);
    expect(sent.output_config.effort).toBe('low');
    expect(JSON.stringify(sent.messages)).toContain('ACROS 1 Fuel at the pump');
    const runs = await env.DB.prepare('SELECT outcome FROM parse_runs WHERE user_id = ?')
      .bind(userId)
      .all();
    expect(runs.results).toEqual([{ outcome: 'ok' }]);
  });

  it('needs an allowlisted account', async () => {
    expect((await tidy(undefined)).status).toBe(401);
    const { cookie } = await signInAs('cy@example.com', 'Cy');
    expect((await tidy(cookie)).status).toBe(403);
  });

  it('rejects empty or oversized text', async () => {
    const { cookie } = await creator();
    expect((await tidy(cookie, { text: '   ' })).status).toBe(400);
    expect((await tidy(cookie, { text: 'x'.repeat(30_001) })).status).toBe(400);
  });

  it('reports text with no clues, and Claude being unavailable', async () => {
    const { cookie } = await creator();
    mockClaude({ text: JSON.stringify({ across: [], down: [], notes: [] }) });
    const empty = await tidy(cookie);
    expect(empty.status).toBe(422);
    expect(await empty.json()).toEqual({ error: "Couldn't find any clues in that text." });
    vi.restoreAllMocks();
    mockClaude({ status: 401 });
    expect((await tidy(cookie)).status).toBe(502);
  });

  it('shares the hourly limit with reading images', async () => {
    const { cookie, userId } = await creator();
    for (let i = 0; i < PARSES_PER_HOUR; i++) {
      await env.DB.prepare(
        "INSERT INTO parse_runs (user_id, created_at, outcome) VALUES (?, ?, 'ok')",
      )
        .bind(userId, Date.now())
        .run();
    }
    const res = await tidy(cookie);
    expect(res.status).toBe(429);
  });
});
