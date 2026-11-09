import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeSocket } from '../../../tests/support/fakeSocket';
import { RoomConnection, roomSocketUrl, type ConnectionStatus } from './RoomConnection';

function setup() {
  const messages: unknown[] = [];
  const statuses: ConnectionStatus[] = [];
  const connection = new RoomConnection({
    url: 'ws://test/api/rooms/x/ws',
    name: 'Ada',
    onMessage: (m) => messages.push(m),
    onStatus: (s) => statuses.push(s),
    createSocket: (url) => new FakeSocket(url),
    initialRetryMs: 100,
    maxRetryMs: 400,
    connectTimeoutMs: 1_000,
  });
  connection.connect();
  return { connection, messages, statuses };
}

beforeEach(() => {
  FakeSocket.reset();
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

describe('RoomConnection', () => {
  it('joins as soon as the socket opens', () => {
    const { statuses } = setup();
    FakeSocket.latest().open();
    expect(FakeSocket.latest().sent).toEqual([{ type: 'join', name: 'Ada' }]);
    expect(statuses).toEqual(['connected']);
  });

  it('delivers valid messages and ignores invalid ones', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { messages } = setup();
    FakeSocket.latest().open();
    FakeSocket.latest().receive({ type: 'pong' });
    FakeSocket.latest().receive('{"type":"nonsense"}');
    expect(messages).toEqual([{ type: 'pong' }]);
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });

  it('only sends while connected', () => {
    const { connection } = setup();
    expect(connection.send({ type: 'ping' })).toBe(false);
    FakeSocket.latest().open();
    expect(connection.send({ type: 'ping' })).toBe(true);
    expect(FakeSocket.latest().sent).toContainEqual({ type: 'ping' });
  });

  it('reconnects with exponential backoff, capped, and resets after success', () => {
    const { statuses } = setup();
    FakeSocket.latest().drop();
    expect(statuses).toEqual(['reconnecting']);

    vi.advanceTimersByTime(99);
    expect(FakeSocket.instances).toHaveLength(1);
    vi.advanceTimersByTime(1); // 100ms
    expect(FakeSocket.instances).toHaveLength(2);

    FakeSocket.latest().drop();
    vi.advanceTimersByTime(200);
    expect(FakeSocket.instances).toHaveLength(3);

    FakeSocket.latest().drop();
    vi.advanceTimersByTime(400);
    FakeSocket.latest().drop();
    vi.advanceTimersByTime(400); // capped at 400ms
    expect(FakeSocket.instances).toHaveLength(5);

    FakeSocket.latest().open();
    FakeSocket.latest().drop();
    vi.advanceTimersByTime(100); // back to the initial delay
    expect(FakeSocket.instances).toHaveLength(6);
    expect(FakeSocket.latest().url).toBe('ws://test/api/rooms/x/ws');
  });

  it('abandons a connection attempt that never opens, and retries', () => {
    const { statuses } = setup();
    const stuck = FakeSocket.latest();
    vi.advanceTimersByTime(1_000);
    expect(stuck.readyState).toBe(3);
    expect(statuses).toEqual(['reconnecting']);
    vi.advanceTimersByTime(100);
    expect(FakeSocket.instances).toHaveLength(2);
  });

  it('does not time out a connection that opened', () => {
    const { statuses } = setup();
    FakeSocket.latest().open();
    vi.advanceTimersByTime(5_000);
    expect(statuses).toEqual(['connected']);
    expect(FakeSocket.instances).toHaveLength(1);
  });

  it('stops for good when closed, even with a retry pending', () => {
    const { connection, statuses } = setup();
    FakeSocket.latest().drop();
    connection.close();
    vi.advanceTimersByTime(10_000);
    expect(FakeSocket.instances).toHaveLength(1);
    expect(statuses.at(-1)).toBe('closed');
    connection.connect();
    expect(FakeSocket.instances).toHaveLength(1);
  });

  it('ignores close events from a socket it already replaced', () => {
    const { connection, statuses } = setup();
    const first = FakeSocket.latest();
    connection.close();
    first.drop();
    expect(statuses).toEqual(['closed']);
  });
});

describe('roomSocketUrl', () => {
  it('uses wss on https and ws on http', () => {
    expect(roomSocketUrl('abc', { protocol: 'https:', host: 'example.com' })).toBe(
      'wss://example.com/api/rooms/abc/ws',
    );
    expect(roomSocketUrl('abc', { protocol: 'http:', host: 'localhost:5173' })).toBe(
      'ws://localhost:5173/api/rooms/abc/ws',
    );
  });
});
