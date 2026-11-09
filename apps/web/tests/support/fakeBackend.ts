import type { Letter } from '@acrosticle/core';
import type { ClientMessage, Member, PuzzleFile } from '@acrosticle/protocol';
import { vi } from 'vitest';
import { FakeSocket } from './fakeSocket';

const COLORS = ['#e4572e', '#1b998b', '#7b2cbf'];

/**
 * An in-memory stand-in for the Worker: the rooms API (via a stubbed `fetch`)
 * and room sockets (via a stubbed `WebSocket`), behaving like the real room.
 */
export class FakeBackend {
  readonly rooms = new Map<string, FakeRoom>();
  private created = 0;

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

    if (url === '/api/rooms' && init?.method === 'POST') {
      const { puzzle } = JSON.parse(init.body as string) as { puzzle: PuzzleFile };
      const roomId = `Created${String(++this.created).padStart(15, '0')}`;
      this.addRoom(puzzle, roomId);
      return json(201, { roomId });
    }
    const roomId = /^\/api\/rooms\/([^/]+)$/.exec(url)?.[1];
    const room = roomId === undefined ? undefined : this.rooms.get(roomId);
    if (room && roomId) return json(200, { roomId, title: room.puzzle.title ?? null });
    return json(404, { error: 'Room not found' });
  }
}

export class FakeRoom {
  readonly cells = new Map<number, Letter>();
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
  remoteEdit(cell: number, value: Letter | null, by = 'someone-else'): void {
    this.apply(cell, value);
    this.broadcast({ type: 'cell/updated', cell, value, version: this.version, by, clientSeq: 0 });
  }

  /** Simulates another solver arriving and moving their cursor. */
  remoteVisitor(member: Member, cell: number): void {
    this.broadcast({ type: 'member/joined', member });
    this.broadcast({ type: 'presence', member: member.id, cell });
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

  private apply(cell: number, value: Letter | null): void {
    if (value === null) this.cells.delete(cell);
    else this.cells.set(cell, value);
    this.version += 1;
  }

  private broadcast(message: Parameters<FakeSocket['receive']>[0]): void {
    for (const [socket, member] of this.sockets) if (member) socket.receive(message);
  }
}
