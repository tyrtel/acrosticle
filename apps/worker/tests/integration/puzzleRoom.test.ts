import { describe, expect, it } from 'vitest';
import { createRoom, TestClient, tinyPuzzleFile } from '../support/rooms';

describe('PuzzleRoom', () => {
  it('sends a snapshot on join: the puzzle, no letters, and the new member', async () => {
    const roomId = await createRoom();
    const { client, snapshot } = await TestClient.join(roomId, 'Ada');

    expect(snapshot.puzzle).toEqual(tinyPuzzleFile);
    expect(snapshot.cells).toEqual([]);
    expect(snapshot.version).toBe(0);
    expect(snapshot.members).toHaveLength(1);
    expect(snapshot.members[0]).toMatchObject({ id: snapshot.you, name: 'Ada' });
    client.close();
  });

  it('broadcasts an edit to everyone, including the sender, with a new version', async () => {
    const roomId = await createRoom();
    const { client: ada, snapshot: adaSnap } = await TestClient.join(roomId, 'Ada');
    const { client: bo } = await TestClient.join(roomId, 'Bo');
    await ada.next('member/joined');

    ada.send({ type: 'cell/set', cell: 3, value: 'R', clientSeq: 7 });

    const expected = {
      type: 'cell/updated',
      cell: 3,
      value: 'R',
      version: 1,
      by: adaSnap.you,
      clientSeq: 7,
    };
    expect(await ada.next('cell/updated')).toEqual(expected);
    expect(await bo.next('cell/updated')).toEqual(expected);
    ada.close();
    bo.close();
  });

  it('saves letters: a later visitor sees them in the snapshot', async () => {
    const roomId = await createRoom();
    const { client: ada } = await TestClient.join(roomId);
    ada.send({ type: 'cell/set', cell: 5, value: 'Z', clientSeq: 1 });
    ada.send({ type: 'cell/set', cell: 1, value: 'Q', clientSeq: 2 });
    ada.send({ type: 'cell/set', cell: 5, value: null, clientSeq: 3 });
    await ada.next('cell/updated');
    await ada.next('cell/updated');
    await ada.next('cell/updated');
    ada.close();

    const { client: later, snapshot } = await TestClient.join(roomId, 'Later');
    expect(snapshot.cells).toEqual([[1, 'Q']]);
    expect(snapshot.version).toBe(3);
    later.close();
  });

  it('overwriting a letter keeps one value per square (last write wins)', async () => {
    const roomId = await createRoom();
    const { client } = await TestClient.join(roomId);
    client.send({ type: 'cell/set', cell: 2, value: 'A', clientSeq: 1 });
    client.send({ type: 'cell/set', cell: 2, value: 'B', clientSeq: 2 });
    await client.next('cell/updated');
    expect(await client.next('cell/updated')).toMatchObject({ value: 'B', version: 2 });
    client.close();

    const { client: again, snapshot } = await TestClient.join(roomId);
    expect(snapshot.cells).toEqual([[2, 'B']]);
    again.close();
  });

  it('announces members joining and leaving, with distinct colors', async () => {
    const roomId = await createRoom();
    const { client: ada, snapshot: adaSnap } = await TestClient.join(roomId, 'Ada');
    const { client: bo, snapshot: boSnap } = await TestClient.join(roomId, 'Bo');

    const joined = await ada.next('member/joined');
    expect(joined.member).toMatchObject({ id: boSnap.you, name: 'Bo' });
    expect(boSnap.members.map((m) => m.name).sort()).toEqual(['Ada', 'Bo']);
    expect(joined.member.color).not.toBe(adaSnap.members[0]?.color);

    bo.close();
    expect(await ada.next('member/left')).toEqual({ type: 'member/left', member: boSnap.you });
    ada.close();
  });

  it('shares presence with others and includes it in snapshots', async () => {
    const roomId = await createRoom();
    const { client: ada, snapshot: adaSnap } = await TestClient.join(roomId, 'Ada');
    ada.send({ type: 'presence/update', cell: 4 });

    const { client: bo, snapshot: boSnap } = await TestClient.join(roomId, 'Bo');
    expect(boSnap.presence).toEqual([[adaSnap.you, 4]]);
    await ada.next('member/joined');

    ada.send({ type: 'presence/update', cell: null });
    expect(await bo.next('presence')).toEqual({
      type: 'presence',
      member: adaSnap.you,
      cell: null,
    });
    ada.close();
    bo.close();
  });

  it.each([
    [
      'a square that does not exist',
      { type: 'cell/set', cell: 6, value: 'A', clientSeq: 1 },
      'There is no square 6.',
    ],
    [
      'presence on a square that does not exist',
      { type: 'presence/update', cell: 99 },
      'There is no square 99.',
    ],
    ['a second join', { type: 'join', name: 'Again' }, 'Already joined.'],
  ])('rejects %s', async (_label, message, error) => {
    const roomId = await createRoom();
    const { client } = await TestClient.join(roomId);
    client.send(message);
    expect(await client.next('error')).toEqual({ type: 'error', message: error });
    client.close();
  });

  it('requires join before editing', async () => {
    const roomId = await createRoom();
    const client = await TestClient.connect(roomId);
    client.send({ type: 'cell/set', cell: 1, value: 'A', clientSeq: 1 });
    expect(await client.next('error')).toMatchObject({
      message: 'Send "join" before anything else.',
    });
    client.close();
  });

  it('answers ping, and rejects binary and malformed messages', async () => {
    const roomId = await createRoom();
    const client = await TestClient.connect(roomId);
    client.send({ type: 'ping' });
    expect(await client.next('pong')).toEqual({ type: 'pong' });

    client.ws.send(new Uint8Array([1, 2, 3]));
    expect(await client.next('error')).toEqual({
      type: 'error',
      message: 'Binary messages are not supported',
    });

    client.ws.send('{"type":"cell/set","cell":-1}');
    expect((await client.next()).type).toBe('error');
    client.close();
  });
});
