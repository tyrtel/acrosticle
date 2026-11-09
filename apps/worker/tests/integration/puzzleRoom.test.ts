import { parseServerMessage, type ServerMessage } from '@acrosticle/protocol';
import { exports } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

async function connect(roomId: string): Promise<WebSocket> {
  const res = await exports.default.fetch(`https://acrosticle.test/api/rooms/${roomId}/ws`, {
    headers: { Upgrade: 'websocket' },
  });
  expect(res.status).toBe(101);
  const ws = res.webSocket;
  if (!ws) throw new Error('No WebSocket on response');
  ws.accept();
  return ws;
}

function nextMessage(ws: WebSocket): Promise<ServerMessage> {
  return new Promise((resolve, reject) => {
    ws.addEventListener(
      'message',
      (event) => {
        const parsed = parseServerMessage(String(event.data));
        if (parsed.ok) resolve(parsed.value);
        else reject(new Error(parsed.error));
      },
      { once: true },
    );
  });
}

describe('PuzzleRoom', () => {
  it('answers ping with pong', async () => {
    const ws = await connect('ping-room');
    const reply = nextMessage(ws);
    ws.send(JSON.stringify({ type: 'ping' }));
    expect(await reply).toEqual({ type: 'pong' });
    ws.close();
  });

  it('broadcasts cell updates to the other members of the room', async () => {
    const alice = await connect('shared-room');
    const bob = await connect('shared-room');

    const received = nextMessage(bob);
    alice.send(JSON.stringify({ type: 'cell/set', cell: 7, value: 'R' }));

    expect(await received).toEqual({ type: 'cell/updated', cell: 7, value: 'R' });
    alice.close();
    bob.close();
  });

  it('rejects binary messages', async () => {
    const ws = await connect('binary-room');
    const reply = nextMessage(ws);
    ws.send(new Uint8Array([1, 2, 3]));
    expect(await reply).toEqual({ type: 'error', message: 'Binary messages are not supported' });
    ws.close();
  });

  it('replies with an error for invalid messages', async () => {
    const ws = await connect('error-room');
    const reply = nextMessage(ws);
    ws.send('{"type":"cell/set","cell":-1,"value":"A"}');
    expect((await reply).type).toBe('error');
    ws.close();
  });
});
