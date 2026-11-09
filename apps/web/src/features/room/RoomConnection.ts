import {
  encodeMessage,
  parseServerMessage,
  type ClientMessage,
  type ServerMessage,
} from '@acrosticle/protocol';

export type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'closed';

/** The parts of the browser WebSocket we use; tests pass a fake. */
export interface SocketLike {
  readonly readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  onopen: ((event: Event) => void) | null;
  onmessage: ((event: MessageEvent) => void) | null;
  onclose: ((event: CloseEvent) => void) | null;
}

export interface RoomConnectionOptions {
  readonly url: string;
  /** Display name sent with `join` on every (re)connect. */
  readonly name: string;
  readonly onMessage: (message: ServerMessage) => void;
  readonly onStatus: (status: ConnectionStatus) => void;
  readonly createSocket?: (url: string) => SocketLike;
  readonly initialRetryMs?: number;
  readonly maxRetryMs?: number;
  /** Abandon a connection attempt that hasn't opened in this long. */
  readonly connectTimeoutMs?: number;
}

const OPEN = 1;

/**
 * One live connection to a room: joins on open, delivers validated server
 * messages, and reconnects with exponential backoff until `close()` is called.
 */
export class RoomConnection {
  private socket: SocketLike | null = null;
  private retries = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private connectTimer: ReturnType<typeof setTimeout> | null = null;
  private closed = false;

  constructor(private readonly options: RoomConnectionOptions) {}

  connect(): void {
    if (this.closed) return;
    const create = this.options.createSocket ?? ((url: string) => new WebSocket(url));
    const socket = create(this.options.url);
    this.socket = socket;
    this.connectTimer = setTimeout(() => {
      // A hung handshake never fires close on its own: give up and retry.
      if (this.socket === socket && socket.readyState !== OPEN) this.abandon(socket);
    }, this.options.connectTimeoutMs ?? 10_000);

    socket.onopen = () => {
      this.clearConnectTimer();
      this.retries = 0;
      socket.send(encodeMessage({ type: 'join', name: this.options.name }));
      this.options.onStatus('connected');
    };
    socket.onmessage = (event) => {
      const parsed = parseServerMessage(String(event.data));
      if (parsed.ok) this.options.onMessage(parsed.value);
      else console.warn('Ignoring invalid message from the room:', parsed.error);
    };
    socket.onclose = () => {
      if (this.socket === socket) this.abandon(socket);
    };
  }

  /** Sends a message if connected. Returns false if it couldn't be sent. */
  send(message: ClientMessage): boolean {
    if (this.socket?.readyState !== OPEN) return false;
    this.socket.send(encodeMessage(message));
    return true;
  }

  close(): void {
    this.closed = true;
    this.clearConnectTimer();
    if (this.retryTimer !== null) clearTimeout(this.retryTimer);
    this.socket?.close(1000, 'Leaving room');
    this.socket = null;
    this.options.onStatus('closed');
  }

  /** Drops a dead or stuck socket and schedules a reconnect. */
  private abandon(socket: SocketLike): void {
    this.clearConnectTimer();
    this.socket = null;
    socket.onclose = null;
    socket.close();
    if (this.closed) return;
    this.options.onStatus('reconnecting');
    this.scheduleReconnect();
  }

  private clearConnectTimer(): void {
    if (this.connectTimer !== null) clearTimeout(this.connectTimer);
    this.connectTimer = null;
  }

  private scheduleReconnect(): void {
    const initial = this.options.initialRetryMs ?? 500;
    const max = this.options.maxRetryMs ?? 10_000;
    const delay = Math.min(max, initial * 2 ** this.retries);
    this.retries += 1;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.connect();
    }, delay);
  }
}

/** The WebSocket URL for a room, relative to the current page's host. */
export function roomSocketUrl(
  roomId: string,
  location: Pick<Location, 'protocol' | 'host'>,
): string {
  const scheme = location.protocol === 'https:' ? 'wss' : 'ws';
  return `${scheme}://${location.host}/api/rooms/${roomId}/ws`;
}
