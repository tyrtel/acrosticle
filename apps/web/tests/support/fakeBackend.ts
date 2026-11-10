import type { Entry } from '@acrosticle/core';
import type {
  ClientMessage,
  Member,
  MeResponse,
  MyRoomsResponse,
  PuzzleFile,
} from '@acrosticle/protocol';
import { vi } from 'vitest';
import sample from '../../../../samples/puzzles/diplo-crostic-37.json';
import { FakeSocket } from './fakeSocket';

const COLORS = ['#e4572e', '#1b998b', '#7b2cbf'];

/**
 * An in-memory stand-in for the Worker: the rooms API (via a stubbed `fetch`)
 * and room sockets (via a stubbed `WebSocket`), behaving like the real room.
 */
export class FakeBackend {
  readonly rooms = new Map<string, FakeRoom>();
  /** The signed-in user's puzzles (created or joined); listed most recently active first. */
  readonly myRooms: MyRoomsResponse['rooms'][number][] = [];
  me: MeResponse = { user: null, canCreate: false, signInConfigured: true };
  /** Delay /api/me answers, to test the session arriving after other data. */
  meDelayMs = 0;
  /** What /api/puzzles/parse answers (status 200 = the body is a ParsePuzzleResponse). */
  parseReply: { status: number; body: unknown } = {
    status: 503,
    body: { error: "Image parsing isn't set up on this server." },
  };
  /** How long parsing takes; the request can be cancelled meanwhile. */
  parseDelayMs = 0;
  /** Images uploaded for parsing. */
  readonly parsedImages: Blob[] = [];
  /** Make the next room creation fail with this response. */
  failNextCreate: { status: number; error: string } | null = null;
  private created = 0;

  signIn({
    canCreate = true,
    name = 'Ada Lovelace',
    email = 'ada@example.com',
    picture = null as string | null,
  } = {}): void {
    this.me = { user: { id: 'u1', name, email, picture }, canCreate, signInConfigured: true };
  }

  /** Pre-creates a room, as if someone shared its link. */
  addRoom(
    puzzle: PuzzleFile,
    roomId = `Room${String(this.rooms.size).padStart(18, '0')}`,
  ): FakeRoom {
    const room = new FakeRoom(puzzle);
    this.rooms.set(roomId, room);
    return room;
  }

  install(): void {
    FakeSocket.reset();
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, init?: RequestInit) => this.fetch(url, init)),
    );
    const rooms = this.rooms;
    vi.stubGlobal(
      'WebSocket',
      class extends FakeSocket {
        constructor(url: string) {
          super(url);
          const roomId = /\/api\/rooms\/([^/]+)\/ws$/.exec(url)?.[1] ?? '';
          rooms.get(roomId)?.accept(this);
        }
      },
    );
  }

  private fetch(url: string, init?: RequestInit): Promise<Response> {
    const json = (status: number, body: unknown) =>
      Promise.resolve(new Response(JSON.stringify(body), { status }));

    if (url === '/api/me') {
      const me = this.me;
      return new Promise((resolve) => setTimeout(resolve, this.meDelayMs)).then(() =>
        json(200, me),
      );
    }
    if (url === '/api/me/rooms') {
      if (!this.me.user) return json(401, { error: 'Sign in to see your puzzles.' });
      const rooms = [...this.myRooms].sort((a, b) => b.updatedAt - a.updatedAt);
      return json(200, { rooms });
    }
    if (url === '/api/puzzles/parse' && init?.method === 'POST') {
      const image = (init.body as FormData).get('image');
      if (image instanceof Blob) this.parsedImages.push(image);
      const { status, body } = this.parseReply;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(
          () => resolve(new Response(JSON.stringify(body), { status })),
          this.parseDelayMs,
        );
        init.signal?.addEventListener('abort', () => {
          clearTimeout(timer);
          reject(new DOMException('Aborted', 'AbortError'));
        });
      });
    }
    if (url === '/api/auth/logout' && init?.method === 'POST') {
      this.me = { user: null, canCreate: false, signInConfigured: this.me.signInConfigured };
      return Promise.resolve(new Response(null, { status: 204 }));
    }
    if (url === '/api/rooms' && init?.method === 'POST') {
      if (this.failNextCreate) {
        const { status, error } = this.failNextCreate;
        this.failNextCreate = null;
        return json(status, { error });
      }
      const body = JSON.parse(init.body as string) as { puzzle?: PuzzleFile; sample?: string };
      // Same rules as the real Worker: samples are free, own puzzles need an allowlisted account.
      let puzzle: PuzzleFile;
      if (body.sample) {
        puzzle = sample;
      } else {
        if (!this.me.user)
          return json(401, { error: 'Sign in to create a room for your own puzzle.' });
        if (!this.me.canCreate) return json(403, { error: 'Not on the allowlist.' });
        puzzle = body.puzzle as PuzzleFile;
      }
      const roomId = `Created${String(++this.created).padStart(15, '0')}`;
      this.addRoom(puzzle, roomId);
      if (this.me.user) {
        const createdAt = Date.UTC(2026, 10, this.created);
        this.myRooms.push({
          roomId,
          title: puzzle.title ?? null,
          createdAt,
          updatedAt: createdAt,
          createdByMe: true,
        });
      }
      return json(201, { roomId });
    }
    const roomId = /^\/api\/rooms\/([^/]+)$/.exec(url)?.[1];
    const room = roomId === undefined ? undefined : this.rooms.get(roomId);
    if (room && roomId && init?.method === 'DELETE') {
      const mine = this.myRooms.find((r) => r.roomId === roomId);
      if (!this.me.user) return json(401, { error: 'Sign in to delete a puzzle.' });
      if (!mine?.createdByMe) return json(403, { error: 'Only the creator can delete it.' });
      room.deleteForEveryone();
      this.rooms.delete(roomId);
      this.myRooms.splice(this.myRooms.indexOf(mine), 1);
      return Promise.resolve(new Response(null, { status: 204 }));
    }
    if (room && roomId) return json(200, { roomId, title: room.puzzle.title ?? null });
    return json(404, { error: 'Room not found' });
  }
}

export class FakeRoom {
  readonly cells = new Map<number, Entry>();
  version = 0;
  private readonly sockets = new Map<FakeSocket, Member | null>();
  private nextMember = 1;

  constructor(readonly puzzle: PuzzleFile) {}

  accept(socket: FakeSocket): void {
    this.sockets.set(socket, null);
    socket.onClientMessage = (message) => this.handle(socket, message);
    queueMicrotask(() => socket.open());
  }

  /** Simulates another solver typing. */
  remoteEdit(cell: number, value: Entry | null, by = 'someone-else'): void {
    this.apply(cell, value);
    this.broadcast({ type: 'cell/updated', cell, value, version: this.version, by, clientSeq: 0 });
  }

  /** Simulates another solver arriving and moving their cursor. */
  remoteVisitor(member: Member, cell: number): void {
    this.broadcast({ type: 'member/joined', member });
    this.broadcast({ type: 'presence', member: member.id, cell });
  }

  /** What the real room does when its creator deletes it. */
  deleteForEveryone(): void {
    this.broadcast({ type: 'room/deleted' });
    for (const socket of this.sockets.keys()) socket.drop();
    this.sockets.clear();
  }

  /** Simulates the network dropping every connection. */
  dropAll(): void {
    for (const socket of this.sockets.keys()) socket.drop();
    this.sockets.clear();
  }

  private handle(socket: FakeSocket, message: ClientMessage): void {
    switch (message.type) {
      case 'join': {
        const member = {
          id: `m${this.nextMember}`,
          name: message.name,
          color: COLORS[this.nextMember % COLORS.length] ?? '#000',
        };
        this.nextMember += 1;
        this.sockets.set(socket, member);
        socket.receive({
          type: 'snapshot',
          puzzle: this.puzzle,
          cells: [...this.cells],
          version: this.version,
          you: member.id,
          members: [...this.sockets.values()].filter((m): m is Member => m !== null),
          presence: [],
        });
        return;
      }
      case 'cell/set': {
        const by = this.sockets.get(socket)?.id ?? '?';
        this.apply(message.cell, message.value);
        this.broadcast({
          type: 'cell/updated',
          cell: message.cell,
          value: message.value,
          version: this.version,
          by,
          clientSeq: message.clientSeq,
        });
        return;
      }
      case 'presence/update':
      case 'ping':
        return;
    }
  }

  private apply(cell: number, value: Entry | null): void {
    if (value === null) this.cells.delete(cell);
    else this.cells.set(cell, value);
    this.version += 1;
  }

  private broadcast(message: Parameters<FakeSocket['receive']>[0]): void {
    for (const [socket, member] of this.sockets) if (member) socket.receive(message);
  }
}
