import type { MeResponse } from '@gridicles/protocol';
import { exports } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { signInAs } from '../support/accounts';
import { CROSSWORD_BASE, miniCrosswordFile } from '../support/crosswords';
import { postRoom, TestClient, tinyPuzzleFile } from '../support/rooms';

async function sampleRoom(): Promise<string> {
  const res = await postRoom({ sample: 'gridicles-mini-1' }, (await signInAs()).cookie);
  expect(res.status).toBe(201);
  return (await res.json<{ roomId: string }>()).roomId;
}

describe('Crosswordicle', () => {
  it('starts the sample crossword for allowlisted accounts, and never sends its answers', async () => {
    const { client, snapshot } = await TestClient.join(await sampleRoom());
    expect(snapshot.puzzle).toMatchObject({
      kind: 'crossword',
      title: 'Gridicles Mini No. 1',
      grid: ['...##', '....#', '.....', '#....', '##...'],
    });
    expect(JSON.stringify(snapshot)).not.toContain('SLATE');
    client.close();
  });

  it('accepts letters and highlights on open squares only', async () => {
    const { client } = await TestClient.join(await sampleRoom());
    client.send({ type: 'cell/set', cell: 13, value: 'A', clientSeq: 1 });
    expect(await client.next('cell/updated')).toMatchObject({ cell: 13, value: 'A' });
    client.send({ type: 'cell/mark', cell: 13, marked: true, clientSeq: 2 });
    expect(await client.next('cell/marked')).toMatchObject({ cell: 13, marked: true });
    // Square 4 is black, and there's no square 26 in a 5×5 grid.
    client.send({ type: 'cell/set', cell: 4, value: 'A', clientSeq: 3 });
    expect(await client.next('error')).toEqual({ type: 'error', message: 'There is no square 4.' });
    client.send({ type: 'cell/mark', cell: 26, marked: true, clientSeq: 4 });
    expect(await client.next('error')).toEqual({
      type: 'error',
      message: 'There is no square 26.',
    });
    client.close();
  });

  it('creates rooms for crossword files, and checks them', async () => {
    const { cookie } = await signInAs();
    expect((await postRoom({ puzzle: miniCrosswordFile }, cookie)).status).toBe(201);

    // Odd grids are allowed (stylized puzzles); only one with nothing to type in is refused.
    const odd = { kind: 'crossword', grid: ['A#', '#B'], clues: { across: [], down: [] } };
    expect((await postRoom({ puzzle: odd }, cookie)).status).toBe(201);
    const noWords = { ...odd, grid: ['##', '##'] };
    const unusable = await postRoom({ puzzle: noWords }, cookie);
    expect(unusable.status).toBe(422);
    expect(await unusable.json()).toMatchObject({
      issues: [{ code: 'no-squares', message: 'The grid has no open squares.' }],
    });

    const uneven = await postRoom({ puzzle: { ...noWords, grid: ['AB', 'C'] } }, cookie);
    expect(uneven.status).toBe(400);
    expect(await uneven.json()).toEqual({
      error: 'Invalid crossword: Row 2 has 1 squares, but row 1 has 2.',
    });
  });

  it('only creates rooms for crosswords', async () => {
    const { cookie } = await signInAs();
    const res = await postRoom({ puzzle: tinyPuzzleFile }, cookie);
    expect(await res.json()).toEqual({
      error: 'This site is for crosswords; that puzzle is an acrostic.',
    });
  });

  it('signs in through Acrosticle, coming back here', async () => {
    const res = await exports.default.fetch(
      `${CROSSWORD_BASE}/api/auth/google?returnTo=%2Fr%2Fabc`,
      {
        redirect: 'manual',
      },
    );
    expect(res.status).toBe(302);
    const location = new URL(res.headers.get('Location') ?? '');
    expect(location.origin + location.pathname).toBe('https://acrosticle.test/api/auth/google');
    expect(location.searchParams.get('returnTo')).toBe('/r/abc');
    expect(location.searchParams.get('returnOrigin')).toBe(CROSSWORD_BASE);

    const me = await (await exports.default.fetch(`${CROSSWORD_BASE}/api/me`)).json<MeResponse>();
    expect(me.signInConfigured).toBe(true);
  });
});
