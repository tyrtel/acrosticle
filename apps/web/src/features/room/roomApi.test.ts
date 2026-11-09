import { parseCompactGrid, type Puzzle } from '@acrosticle/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRoom, createSampleRoom, getRoomInfo } from './roomApi';

const ROOM = 'AbCdEfGhIjKlMnOpQrSt_-';

function puzzle(): Puzzle {
  const grid = parseCompactGrid(2, ['1A 2A']);
  if (!grid.ok) throw new Error(grid.error);
  return { title: 'T', grid: grid.grid, clues: [{ label: 'A', text: 'x', cells: [1, 2] }] };
}

function mockFetch(status: number, body: unknown) {
  const fetchMock = vi.fn(() => Promise.resolve(new Response(JSON.stringify(body), { status })));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => vi.unstubAllGlobals());

describe('createRoom', () => {
  it('posts the puzzle file and returns the room id', async () => {
    const fetchMock = mockFetch(201, { roomId: ROOM });
    expect(await createRoom(puzzle())).toEqual({ ok: true, value: ROOM });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/rooms');
    expect(JSON.parse(init.body as string)).toEqual({
      puzzle: {
        title: 'T',
        grid: { columns: 2, rows: ['1A 2A'] },
        clues: [{ label: 'A', text: 'x', cells: [1, 2] }],
      },
    });
  });

  it('returns the server error, including validation issues', async () => {
    mockFetch(422, {
      error: 'The puzzle has errors.',
      issues: [{ code: 'x', message: 'Square 2 is wrong.' }],
    });
    expect(await createRoom(puzzle())).toEqual({
      ok: false,
      status: 422,
      error: 'The puzzle has errors. Square 2 is wrong.',
    });
  });

  it('handles an unreadable error body', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response('oops', { status: 502 }))),
    );
    expect(await createRoom(puzzle())).toEqual({
      ok: false,
      status: 502,
      error: 'Request failed (502).',
    });
  });

  it('handles network failures', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new TypeError('offline'))),
    );
    expect(await createRoom(puzzle())).toMatchObject({ ok: false, status: 0 });
  });

  it('explains a timeout', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new DOMException('slow', 'TimeoutError'))),
    );
    expect(await createRoom(puzzle())).toEqual({
      ok: false,
      status: 0,
      error: 'The server took too long to respond. Please try again.',
    });
  });

  it('passes a timeout signal with every request', async () => {
    const fetchMock = mockFetch(201, { roomId: ROOM });
    await createRoom(puzzle());
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('rejects an unexpected success body', async () => {
    mockFetch(201, { roomId: 'not-valid' });
    expect(await createRoom(puzzle())).toMatchObject({
      ok: false,
      error: 'The server sent an unexpected response.',
    });
  });
});

describe('createSampleRoom', () => {
  it('asks for the sample by id, sending no puzzle', async () => {
    const fetchMock = mockFetch(201, { roomId: ROOM });
    expect(await createSampleRoom('diplo-crostic-37')).toEqual({ ok: true, value: ROOM });
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({ sample: 'diplo-crostic-37' });
  });
});

describe('getRoomInfo', () => {
  it('returns room info, or the 404', async () => {
    mockFetch(200, { roomId: ROOM, title: null });
    expect(await getRoomInfo(ROOM)).toEqual({ ok: true, value: { roomId: ROOM, title: null } });

    mockFetch(404, { error: 'Room not found' });
    expect(await getRoomInfo(ROOM)).toEqual({ ok: false, status: 404, error: 'Room not found' });
  });
});
