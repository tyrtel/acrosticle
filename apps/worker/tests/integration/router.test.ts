import { exports } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';
import sample from '../../../../samples/puzzles/diplo-crostic-37.json';
import { MAX_CREATE_BODY_BYTES } from '../../src/router';
import { signInAs } from '../support/accounts';
import { BASE, createRoom, postRoom, tinyPuzzleFile } from '../support/rooms';

describe('GET /api/health', () => {
  it('returns ok', async () => {
    const res = await exports.default.fetch(`${BASE}/api/health`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok' });
  });
});

describe('POST /api/rooms with a puzzle file', () => {
  let cookie: string;
  beforeEach(async () => {
    ({ cookie } = await signInAs('ada@example.com'));
  });

  it('creates a room with an unguessable id for an allowlisted user', async () => {
    const res = await postRoom({ puzzle: tinyPuzzleFile }, cookie);
    expect(res.status).toBe(201);
    const { roomId } = await res.json<{ roomId: string }>();
    expect(roomId).toMatch(/^[A-Za-z0-9_-]{22}$/);
  });

  it('accepts the sample puzzle file as-is', async () => {
    expect((await postRoom({ puzzle: sample }, cookie)).status).toBe(201);
  });

  it('gives each room a different id', async () => {
    const ids = await Promise.all([1, 2, 3].map(() => createRoom()));
    expect(new Set(ids).size).toBe(3);
  });

  it('matches allowlist emails ignoring case and spaces', async () => {
    const bo = await signInAs('BO@example.com', 'Bo');
    expect((await postRoom({ puzzle: tinyPuzzleFile }, bo.cookie)).status).toBe(201);
  });

  it('requires sign-in', async () => {
    const res = await postRoom({ puzzle: tinyPuzzleFile });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Sign in to create a room for your own puzzle.' });
  });

  it('requires the account to be on the allowlist', async () => {
    const cy = await signInAs('cy@example.com', 'Cy');
    const res = await postRoom({ puzzle: tinyPuzzleFile }, cy.cookie);
    expect(res.status).toBe(403);
    expect((await res.json<{ error: string }>()).error).toContain('cy@example.com');
  });

  it('rejects a puzzle with validation errors, listing them', async () => {
    const broken = {
      ...tinyPuzzleFile,
      grid: { ...tinyPuzzleFile.grid, rows: ['1A 2A # 3A', '4B # 5A'] },
    };
    const res = await postRoom({ puzzle: broken }, cookie);
    expect(res.status).toBe(422);
    const body = await res.json<{ error: string; issues: { code: string }[] }>();
    expect(body.issues.map((i) => i.code)).toEqual(['label-mismatch']);
  });

  it.each([
    ['invalid JSON', '{nope', 400],
    ['a missing puzzle', {}, 400],
    ['an unknown sample', { sample: 'nope' }, 400],
    [
      'a bad grid token',
      { puzzle: { ...tinyPuzzleFile, grid: { columns: 4, rows: ['1A ?? # 3A'] } } },
      400,
    ],
  ])('rejects %s', async (_label, body, status) => {
    expect((await postRoom(body, cookie)).status).toBe(status);
  });

  it('rejects oversized bodies', async () => {
    const res = await postRoom(
      { puzzle: tinyPuzzleFile, padding: 'x'.repeat(MAX_CREATE_BODY_BYTES) },
      cookie,
    );
    expect(res.status).toBe(413);
  });
});

describe('POST /api/rooms for a sample', () => {
  it('works without signing in, using the server copy of the sample', async () => {
    const res = await postRoom({ sample: 'diplo-crostic-37' });
    expect(res.status).toBe(201);
    const { roomId } = await res.json<{ roomId: string }>();
    const info = await exports.default.fetch(`${BASE}/api/rooms/${roomId}`);
    expect(await info.json()).toEqual({ roomId, title: 'Diplo-Crostic No. 37' });
  });

  it('ignores any puzzle sent alongside the sample id', async () => {
    const res = await postRoom({ sample: 'diplo-crostic-37', puzzle: tinyPuzzleFile });
    const { roomId } = await res.json<{ roomId: string }>();
    const info = await exports.default.fetch(`${BASE}/api/rooms/${roomId}`);
    expect(await info.json()).toMatchObject({ title: 'Diplo-Crostic No. 37' });
  });
});

describe('cross-site requests', () => {
  it('rejects POSTs from another origin', async () => {
    const res = await exports.default.fetch(`${BASE}/api/rooms`, {
      method: 'POST',
      headers: { Origin: 'https://evil.example', 'Content-Type': 'application/json' },
      body: JSON.stringify({ sample: 'diplo-crostic-37' }),
    });
    expect(res.status).toBe(403);
  });

  it('allows POSTs from our own origin', async () => {
    const res = await exports.default.fetch(`${BASE}/api/rooms`, {
      method: 'POST',
      headers: { Origin: 'https://acrosticle.test', 'Content-Type': 'application/json' },
      body: JSON.stringify({ sample: 'diplo-crostic-37' }),
    });
    expect(res.status).toBe(201);
  });
});

describe('GET /api/rooms/:id', () => {
  it("returns the room's title", async () => {
    const roomId = await createRoom();
    const res = await exports.default.fetch(`${BASE}/api/rooms/${roomId}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ roomId, title: 'Tiny' });
  });

  it('returns null for an untitled puzzle', async () => {
    const { title: _title, ...untitled } = tinyPuzzleFile;
    const roomId = await createRoom(untitled);
    const res = await exports.default.fetch(`${BASE}/api/rooms/${roomId}`);
    expect(await res.json()).toEqual({ roomId, title: null });
  });

  it('returns 404 for a room that was never created', async () => {
    const res = await exports.default.fetch(`${BASE}/api/rooms/AAAAAAAAAAAAAAAAAAAAAA`);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Room not found' });
  });
});

describe('room sockets', () => {
  it('returns 404 for a well-formed id that was never created', async () => {
    const res = await exports.default.fetch(`${BASE}/api/rooms/AAAAAAAAAAAAAAAAAAAAAA/ws`, {
      headers: { Upgrade: 'websocket' },
    });
    expect(res.status).toBe(404);
  });

  it('returns 404 for a malformed room id', async () => {
    const res = await exports.default.fetch(`${BASE}/api/rooms/abc/ws`, {
      headers: { Upgrade: 'websocket' },
    });
    expect(res.status).toBe(404);
  });

  it('requires a WebSocket upgrade', async () => {
    const roomId = await createRoom();
    expect((await exports.default.fetch(`${BASE}/api/rooms/${roomId}/ws`)).status).toBe(426);
  });
});

it('returns 404 for unknown routes', async () => {
  expect((await exports.default.fetch(`${BASE}/nope`)).status).toBe(404);
});
