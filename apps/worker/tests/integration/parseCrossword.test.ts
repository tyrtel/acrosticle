import type { ParseCrosswordResponse } from '@gridicles/protocol';
import { env, exports } from 'cloudflare:workers';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { signInAs } from '../support/accounts';
import { mockClaude } from '../support/claude';
import { BASE } from '../support/rooms';

afterEach(() => vi.restoreAllMocks());
beforeEach(async () => {
  await env.DB.prepare('DELETE FROM parse_runs').run();
});

function upload(cookie?: string) {
  const form = new FormData();
  form.set('image', new File([new Uint8Array(64).fill(7)], 'grid.png', { type: 'image/png' }));
  return exports.default.fetch(`${BASE}/api/crosswords/parse`, {
    method: 'POST',
    headers: { Origin: BASE, ...(cookie ? { Cookie: cookie } : {}) },
    body: form,
  });
}

const answer = {
  title: 'Barred',
  author: '',
  instructions: '',
  style: 'standard',
  width: 2,
  height: 2,
  rows: ['..', '..'],
  bars: [{ row: 1, column: 1, side: 'right' }],
  across: [{ number: 1, text: 'One' }],
  down: [],
  notes: ['Square 4 was blurry.'],
};

describe('POST /api/crosswords/parse', () => {
  it('reads a crossword image into a draft, and logs the run', async () => {
    const { cookie, userId } = await signInAs('bo@example.com', 'Bo');
    const bodies = mockClaude({ text: JSON.stringify(answer) });
    const res = await upload(cookie);
    expect(res.status).toBe(200);
    const body = await res.json<ParseCrosswordResponse>();
    expect(body.file).toMatchObject({
      kind: 'crossword',
      title: 'Barred',
      bars: { right: [1], bottom: [] },
    });
    expect(body.notes).toEqual(['Square 4 was blurry.']);
    expect(JSON.stringify(bodies[0])).toContain('Transcribe this crossword.');
    const runs = await env.DB.prepare('SELECT outcome FROM parse_runs WHERE user_id = ?')
      .bind(userId)
      .all();
    expect(runs.results).toEqual([{ outcome: 'ok' }]);
  });

  it('needs an allowlisted account', async () => {
    expect((await upload()).status).toBe(401);
    expect((await upload((await signInAs('cy@example.com', 'Cy')).cookie)).status).toBe(403);
  });
});

describe('a second look with a stronger model', () => {
  // 1 Across and 1-2 Down in a 2×2 grid; the cheap read misses a bar, the strong one doesn't.
  const clues = {
    across: [
      { number: 1, text: 'One' },
      { number: 3, text: 'Three' },
    ],
    down: [
      { number: 1, text: 'a' },
      { number: 2, text: 'b' },
    ],
  };
  const good = { ...answer, bars: [], across: clues.across, down: clues.down, notes: [] };
  const bad = { ...good, bars: [{ row: 1, column: 1, side: 'right' }] };

  it("reads again when the grid doesn't fit the clue numbers, keeping the better read", async () => {
    const { cookie, userId } = await signInAs('bo@example.com', 'Bo');
    const bodies = mockClaude((body) => ({
      text: JSON.stringify(body.model === env.PARSE_STRONG_MODEL ? good : bad),
    }));
    const res = await upload(cookie);
    const body = await res.json<ParseCrosswordResponse>();
    expect(bodies.map((b) => b.model)).toEqual([env.PARSE_MODEL, env.PARSE_STRONG_MODEL]);
    expect(body.file.bars).toBeUndefined();
    expect(body.notes).toEqual([
      'The first reading of the grid didn’t match the clue numbers, so it was read again more carefully.',
    ]);
    const runs = await env.DB.prepare('SELECT cost_usd FROM parse_runs WHERE user_id = ?')
      .bind(userId)
      .all<{ cost_usd: number }>();
    expect(runs.results).toHaveLength(1); // both reads, logged as one run with their total cost
    expect(body.costUsd).toBeCloseTo(runs.results[0]?.cost_usd ?? 0);
  });

  it('reads once when the grid fits', async () => {
    const { cookie } = await signInAs('bo@example.com', 'Bo');
    const bodies = mockClaude({ text: JSON.stringify(good) });
    await upload(cookie);
    expect(bodies).toHaveLength(1);
  });

  it("skips the second look once today's budget is used up", async () => {
    const { cookie, userId } = await signInAs('bo@example.com', 'Bo');
    const budget = Number(env.PARSE_DAILY_BUDGET_USD);
    await env.DB.prepare(
      "INSERT INTO parse_runs (user_id, created_at, outcome, cost_usd) VALUES (?, ?, 'ok', ?)",
    )
      .bind(userId, Date.now(), budget - 0.0001)
      .run();
    const bodies = mockClaude({ text: JSON.stringify(bad) });
    expect((await upload(cookie)).status).toBe(200);
    expect(bodies).toHaveLength(1);
  });
});
