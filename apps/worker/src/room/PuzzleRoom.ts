import {
  encodeMessage,
  parseClientMessage,
  type ClientMessage,
  type ServerMessage,
} from '@acrosticle/protocol';
import { DurableObject } from 'cloudflare:workers';

const NORMAL_CLOSURE = 1000;
const RESERVED_CLOSE_CODES = new Set([1005, 1006, 1015]);

/**
 * One instance per shared solving session. Holds the WebSocket connections for
 * everyone in the room and relays changes between them.
 *
 * Uses the WebSocket Hibernation API, so an idle room is evicted from memory
 * without dropping its connections.
 *
 * TODO(planning): store solve state (SQLite storage), send a snapshot when a
 * client joins, presence/cursors, and the conflict policy (see docs/adr).
 */
export class PuzzleRoom extends DurableObject<Env> {
  override fetch(request: Request): Response {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected a WebSocket upgrade', { status: 426 });
    }

    const { 0: client, 1: server } = new WebSocketPair();
    this.ctx.acceptWebSocket(server);
    return new Response(null, { status: 101, webSocket: client });
  }

  override webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): void {
    if (typeof raw !== 'string') {
      this.send(ws, { type: 'error', message: 'Binary messages are not supported' });
      return;
    }

    const parsed = parseClientMessage(raw);
    if (!parsed.ok) {
      this.send(ws, { type: 'error', message: parsed.error });
      return;
    }

    this.handle(ws, parsed.value);
  }

  override webSocketClose(ws: WebSocket, code: number, reason: string): void {
    // 1005/1006/1015 only describe how a socket closed; sending them back is not allowed.
    const replyCode = RESERVED_CLOSE_CODES.has(code) ? NORMAL_CLOSURE : code;
    try {
      ws.close(replyCode, reason);
    } catch {
      // Already closed (e.g. the runtime auto-replied to the close frame).
    }
  }

  private handle(sender: WebSocket, message: ClientMessage): void {
    switch (message.type) {
      case 'ping':
        this.send(sender, { type: 'pong' });
        return;
      case 'cell/set':
        this.broadcast({ type: 'cell/updated', cell: message.cell, value: message.value }, sender);
        return;
    }
  }

  private send(ws: WebSocket, message: ServerMessage): void {
    ws.send(encodeMessage(message));
  }

  private broadcast(message: ServerMessage, except?: WebSocket): void {
    const payload = encodeMessage(message);
    for (const ws of this.ctx.getWebSockets()) {
      if (ws !== except) ws.send(payload);
    }
  }
}
