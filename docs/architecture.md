# Architecture

## Overview

```
 Browser (React)                      Cloudflare edge
┌──────────────────────┐   HTTPS    ┌──────────────────────────┐
│ apps/web             │──────────▶ │ apps/worker (router)     │
│  features/…          │            │   /api/health            │
│  lib/ (WS client)    │  WebSocket │   /api/rooms/:id/ws ─┐   │
│                      │◀─────────▶ │                      ▼   │
└─────────┬────────────┘            │  PuzzleRoom (Durable Obj)│
          │                         │  one per room, holds     │
          │                         │  sockets + solve state   │
          ▼                         └────────────┬─────────────┘
 @acrosticle/protocol  ◀── shared ──▶            │
 @acrosticle/core      ◀── shared ──▶ ───────────┘
```

- **`packages/core`**: pure domain logic: letters, solve state, and later puzzle parsing, grid↔clue
  mapping, completion checks. Runs identically in the browser and in the Durable Object.
- **`packages/protocol`**: the WebSocket message contract (Zod schemas plus parse/encode). Both sides
  validate everything they receive.
- **`apps/worker`**: a thin HTTP router plus the `PuzzleRoom` Durable Object. Each room is a single
  Durable Object instance, so every update to a room passes through one place in a fixed order. That
  ordering is what makes real-time collaboration simple to reason about.
- **`apps/web`**: the React UI, organised by feature.

## Real-time flow (current skeleton)

1. The client opens `wss://…/api/rooms/{roomId}/ws`.
2. The Worker routes the request to `PUZZLE_ROOM.getByName(roomId)`.
3. `PuzzleRoom` accepts the socket with the Hibernation API, so idle rooms cost nothing.
4. The client sends `cell/set`. The room validates it and broadcasts `cell/updated` to the other clients.

## Decisions and open questions

Product decisions (no answer checking, sign-in to create puzzles, link-based editing, rooms kept
indefinitely, phone photos as a stretch goal) and the remaining open questions are tracked in
[`planning/design.md` §11](planning/design.md#11-decisions-and-open-questions).
