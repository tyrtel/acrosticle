import { parseServerMessage, type PuzzleFile, type ServerMessage } from '@acrosticle/protocol';
import { exports } from 'cloudflare:workers';
import { expect } from 'vitest';
import { signInAs } from './accounts';

export const BASE = 'https://acrosticle.test';

/**
 *   1A 2B  #  3A
 *   4B  #  5A
 * Clue A = 3, 1, 5. Clue B = 4, 2.
 */
export const tinyPuzzleFile: PuzzleFile = {
  title: 'Tiny',
  grid: { columns: 4, rows: ['1A 2B # 3A', '4B # 5A'] },
  clues: [
    { label: 'A', text: 'First', cells: [3, 1, 5] },
    { label: 'B', text: 'Second', cells: [4, 2] },
  ],
};

export function postRoom(body: unknown, cookie?: string): Promise<Response> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (cookie) headers.Cookie = cookie;
  return exports.default.fetch(`${BASE}/api/rooms`, {
    method: 'POST',
    headers,
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

/** Creates a room as an allowlisted user. */
export async function createRoom(puzzle: PuzzleFile = tinyPuzzleFile): Promise<string> {
  const { cookie } = await signInAs();
  const res = await postRoom({ puzzle }, cookie);
  expect(res.status).toBe(201);
  const { roomId } = await res.json<{ roomId: string }>();
  return roomId;
}

/** A WebSocket client that queues every server message so none are missed. */
export class TestClient {
  private readonly received: ServerMessage[] = [];
  private readonly waiters: ((message: ServerMessage) => void)[] = [];

  private constructor(readonly ws: WebSocket) {
    this.closed = new Promise((resolve) => {
      ws.addEventListener('close', (event) => resolve(event.code));
    });
    ws.addEventListener('message', (event) => {
      const parsed = parseServerMessage(String(event.data));
      if (!parsed.ok) throw new Error(`Server sent an invalid message: ${parsed.error}`);
      const waiter = this.waiters.shift();
      if (waiter) waiter(parsed.value);
      else this.received.push(parsed.value);
    });
  }

  /** Resolves with the close code when the server closes the connection. */
  readonly closed: Promise<number>;

  static async connect(roomId: string, cookie?: string): Promise<TestClient> {
    const res = await exports.default.fetch(`${BASE}/api/rooms/${roomId}/ws`, {
      headers: { Upgrade: 'websocket', ...(cookie ? { Cookie: cookie } : {}) },
    });
    expect(res.status).toBe(101);
    if (!res.webSocket) throw new Error('No WebSocket on response');
    res.webSocket.accept();
    return new TestClient(res.webSocket);
  }

  /** Connects and joins, returning the client and its snapshot. */
  static async join(roomId: string, name = 'Ada', cookie?: string) {
    const client = await TestClient.connect(roomId, cookie);
    client.send({ type: 'join', name });
    const snapshot = await client.next('snapshot');
    return { client, snapshot };
  }

  send(message: unknown): void {
    this.ws.send(JSON.stringify(message));
  }

  /** The next message, optionally asserting its type. */
  async next<T extends ServerMessage['type']>(
    type?: T,
  ): Promise<Extract<ServerMessage, { type: T }>> {
    const message =
      this.received.shift() ??
      (await new Promise<ServerMessage>((resolve) => this.waiters.push(resolve)));
    if (type) expect(message.type).toBe(type);
    return message as Extract<ServerMessage, { type: T }>;
  }

  close(): void {
    this.ws.close(1000, 'done');
  }
}
