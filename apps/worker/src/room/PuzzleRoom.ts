import { isLetter, puzzleFromCompact, type Letter } from '@acrosticle/core';
import {
  encodeMessage,
  parseClientMessage,
  PuzzleFile,
  validateWith,
  type ClientMessage,
  type Member,
  type ServerMessage,
} from '@acrosticle/protocol';
import { DurableObject } from 'cloudflare:workers';
import { pickColor } from './colors';

const NORMAL_CLOSURE = 1000;
const RESERVED_CLOSE_CODES = new Set([1005, 1006, 1015]);

/** Per-connection state, stored on the socket so it survives hibernation. */
interface Attachment {
  readonly memberId: string;
  /** Null until the client sends `join`. */
  readonly name: string | null;
  readonly color: string;
  readonly cell: number | null;
}

interface RoomInfo {
  readonly puzzle: PuzzleFile;
  readonly cellCount: number;
}

/**
 * One instance per shared solving session. It owns the room's puzzle and
 * solve state (in SQLite storage) and the WebSocket connections of everyone
 * in the room. Every edit goes through here in order, gets a new room version,
 * is saved, and is then broadcast to all members (see ADR 0002).
 *
 * Uses the WebSocket Hibernation API, so an idle room is evicted from memory
 * without dropping its connections.
 */
export class PuzzleRoom extends DurableObject<Env> {
  private readonly sql: SqlStorage;
  private loaded: RoomInfo | null = null;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec('CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
    this.sql.exec(
      `CREATE TABLE IF NOT EXISTS cells (
        cell INTEGER PRIMARY KEY,
        letter TEXT NOT NULL,
        updated_by TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      )`,
    );
  }

  /**
   * Stores the puzzle for a new room. Called once, by the router, right after
   * the puzzle passed validation. Returns false if the room already exists.
   */
  initialize(puzzle: PuzzleFile, createdBy: string): boolean {
    if (this.readMeta('puzzle') !== null) return false;
    const converted = puzzleFromCompact(puzzle);
    if (!converted.ok) throw new Error(`initialize() got an invalid puzzle: ${converted.error}`);
    const cellCount = converted.puzzle.grid.squares.filter((s) => s.kind === 'letter').length;

    this.ctx.storage.transactionSync(() => {
      this.writeMeta('puzzle', JSON.stringify(puzzle));
      this.writeMeta('cellCount', String(cellCount));
      this.writeMeta('version', '0');
      this.writeMeta('createdBy', createdBy);
      this.writeMeta('createdAt', String(Date.now()));
    });
    this.loaded = { puzzle, cellCount };
    return true;
  }

  /** Public facts about the room, or null if it was never created. */
  info(): { title: string | null } | null {
    const room = this.room();
    return room ? { title: room.puzzle.title ?? null } : null;
  }

  override fetch(request: Request): Response {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected a WebSocket upgrade', { status: 426 });
    }
    if (!this.room()) {
      return Response.json({ error: 'Room not found' }, { status: 404 });
    }

    const { 0: client, 1: server } = new WebSocketPair();
    this.ctx.acceptWebSocket(server);
    const attachment: Attachment = {
      memberId: crypto.randomUUID(),
      name: null,
      color: '',
      cell: null,
    };
    server.serializeAttachment(attachment);
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
    const { memberId, name } = attachmentOf(ws);
    if (name !== null) this.broadcast({ type: 'member/left', member: memberId }, ws);

    // 1005/1006/1015 only describe how a socket closed; sending them back is not allowed.
    const replyCode = RESERVED_CLOSE_CODES.has(code) ? NORMAL_CLOSURE : code;
    try {
      ws.close(replyCode, reason);
    } catch {
      // Already closed (e.g. the runtime auto-replied to the close frame).
    }
  }

  private handle(ws: WebSocket, message: ClientMessage): void {
    const me = attachmentOf(ws);
    if (message.type === 'ping') {
      this.send(ws, { type: 'pong' });
      return;
    }
    if (message.type === 'join') {
      this.join(ws, me, message.name);
      return;
    }
    if (me.name === null) {
      this.send(ws, { type: 'error', message: 'Send "join" before anything else.' });
      return;
    }

    switch (message.type) {
      case 'cell/set':
        this.setCell(ws, me, message);
        return;
      case 'presence/update':
        this.updatePresence(ws, me, message.cell);
        return;
    }
  }

  private join(ws: WebSocket, me: Attachment, name: string): void {
    if (me.name !== null) {
      this.send(ws, { type: 'error', message: 'Already joined.' });
      return;
    }
    const color = pickColor(this.members().map((m) => m.color));
    const joined: Attachment = { ...me, name, color };
    ws.serializeAttachment(joined);

    this.send(ws, this.snapshot(joined.memberId));
    this.broadcast({ type: 'member/joined', member: toMember(joined, name) }, ws);
  }

  private setCell(
    ws: WebSocket,
    me: Attachment,
    { cell, value, clientSeq }: Extract<ClientMessage, { type: 'cell/set' }>,
  ): void {
    const room = this.room();
    if (!room || cell > room.cellCount) {
      this.send(ws, { type: 'error', message: `There is no square ${cell}.` });
      return;
    }

    const version = this.ctx.storage.transactionSync(() => {
      if (value === null) {
        this.sql.exec('DELETE FROM cells WHERE cell = ?', cell);
      } else {
        this.sql.exec(
          `INSERT INTO cells (cell, letter, updated_by, updated_at) VALUES (?, ?, ?, ?)
           ON CONFLICT(cell) DO UPDATE SET
             letter = excluded.letter,
             updated_by = excluded.updated_by,
             updated_at = excluded.updated_at`,
          cell,
          value,
          me.memberId,
          Date.now(),
        );
      }
      const next = Number(this.readMeta('version') ?? '0') + 1;
      this.writeMeta('version', String(next));
      return next;
    });

    this.broadcast({ type: 'cell/updated', cell, value, version, by: me.memberId, clientSeq });
  }

  private updatePresence(ws: WebSocket, me: Attachment, cell: number | null): void {
    const room = this.room();
    if (cell !== null && (!room || cell > room.cellCount)) {
      this.send(ws, { type: 'error', message: `There is no square ${cell}.` });
      return;
    }
    ws.serializeAttachment({ ...me, cell });
    this.broadcast({ type: 'presence', member: me.memberId, cell }, ws);
  }

  private snapshot(you: string): ServerMessage {
    const room = this.room();
    if (!room) throw new Error('snapshot() called before the room was initialized');

    const cells = this.sql
      .exec<{ cell: number; letter: string }>('SELECT cell, letter FROM cells ORDER BY cell')
      .toArray()
      .flatMap(({ cell, letter }): [number, Letter][] =>
        isLetter(letter) ? [[cell, letter]] : [],
      );
    const joined = this.joinedAttachments();

    return {
      type: 'snapshot',
      puzzle: room.puzzle,
      cells,
      version: Number(this.readMeta('version') ?? '0'),
      you,
      members: joined.map(({ attachment, name }) => toMember(attachment, name)),
      presence: joined.flatMap(({ attachment }) =>
        attachment.cell === null
          ? []
          : [[attachment.memberId, attachment.cell] as [string, number]],
      ),
    };
  }

  /** The room's puzzle, loaded from storage on first use after a wake-up. Null if never initialized. */
  private room(): RoomInfo | null {
    if (this.loaded) return this.loaded;
    const stored = this.readMeta('puzzle');
    if (stored === null) return null;
    const puzzle = validateWith(PuzzleFile, JSON.parse(stored));
    if (!puzzle.ok) throw new Error(`Stored puzzle is invalid: ${puzzle.error}`);
    this.loaded = { puzzle: puzzle.value, cellCount: Number(this.readMeta('cellCount')) };
    return this.loaded;
  }

  private members(): Member[] {
    return this.joinedAttachments().map(({ attachment, name }) => toMember(attachment, name));
  }

  private joinedAttachments(except?: WebSocket) {
    return this.ctx.getWebSockets().flatMap((ws) => {
      if (ws === except) return [];
      const attachment = attachmentOf(ws);
      return attachment.name === null ? [] : [{ ws, attachment, name: attachment.name }];
    });
  }

  private send(ws: WebSocket, message: ServerMessage): void {
    ws.send(encodeMessage(message));
  }

  /** Sends to every joined member, optionally skipping one socket. */
  private broadcast(message: ServerMessage, except?: WebSocket): void {
    const payload = encodeMessage(message);
    for (const { ws } of this.joinedAttachments(except)) ws.send(payload);
  }

  private readMeta(key: string): string | null {
    const [row] = this.sql
      .exec<{ value: string }>('SELECT value FROM meta WHERE key = ?', key)
      .toArray();
    return row?.value ?? null;
  }

  private writeMeta(key: string, value: string): void {
    this.sql.exec(
      'INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      key,
      value,
    );
  }
}

function attachmentOf(ws: WebSocket): Attachment {
  return ws.deserializeAttachment() as Attachment;
}

function toMember(attachment: Attachment, name: string): Member {
  return { id: attachment.memberId, name, color: attachment.color };
}
