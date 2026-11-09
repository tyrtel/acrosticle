import type { ClientMessage, ServerMessage } from '@acrosticle/protocol';
import type { SocketLike } from '../../src/features/room/RoomConnection';

/** An in-memory WebSocket for tests. The test drives the "server" side. */
export class FakeSocket implements SocketLike {
  static instances: FakeSocket[] = [];
  readyState = 0;
  readonly sent: ClientMessage[] = [];
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  /** Lets a fake server react to what the client sends. */
  onClientMessage: ((message: ClientMessage) => void) | null = null;

  constructor(readonly url: string) {
    FakeSocket.instances.push(this);
  }

  static latest(): FakeSocket {
    const socket = FakeSocket.instances.at(-1);
    if (!socket) throw new Error('No socket was created');
    return socket;
  }

  static reset(): void {
    FakeSocket.instances = [];
  }

  send(data: string): void {
    const message = JSON.parse(data) as ClientMessage;
    this.sent.push(message);
    this.onClientMessage?.(message);
  }

  close(): void {
    this.readyState = 3;
  }

  // --- server side ---
  open(): void {
    this.readyState = 1;
    this.onopen?.(new Event('open'));
  }

  receive(message: ServerMessage | string): void {
    const data = typeof message === 'string' ? message : JSON.stringify(message);
    this.onmessage?.(new MessageEvent('message', { data }));
  }

  drop(): void {
    this.readyState = 3;
    this.onclose?.(new CloseEvent('close', { code: 1006 }));
  }
}
