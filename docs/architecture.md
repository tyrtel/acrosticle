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

## HTTP API

| Method and path         | Purpose                                                                                                            |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `GET /api/health`       | Liveness check                                                                                                     |
| `POST /api/rooms`       | Create a room for a puzzle file. Requires a signed-in user (see below); validates the puzzle; returns `{ roomId }` |
| `GET /api/rooms/:id`    | Check a room exists before joining; returns `{ roomId, title }` or 404                                             |
| `GET /api/rooms/:id/ws` | WebSocket upgrade into the room                                                                                    |

Room ids are 128 random bits (22 base64url characters). The link is the access control for solving.

**Sign-in (temporary):** until Google sign-in lands in M4, `getCurrentUser` in `apps/worker/src/auth.ts`
denies room creation unless `DEV_ALLOW_ANONYMOUS` is `"true"`. `npm run dev` and the tests set it; the
committed `wrangler.jsonc` default is `"false"`, so a deployment denies by default.

## Real-time flow

1. The page calls `GET /api/rooms/:id`, asks for a display name (remembered in `localStorage`), then opens
   the WebSocket.
2. The client sends `join`; the `PuzzleRoom` replies with a `snapshot` (puzzle, letters, version, members,
   cursors) and tells everyone else `member/joined`.
3. Typing applies the edit locally right away (shown as _pending_) and sends `cell/set` with a client
   sequence number.
4. The room applies edits one at a time in arrival order, saves them in SQLite with a new room version, and
   broadcasts `cell/updated` to **everyone, sender included**. The sender drops its pending edit when its
   own echo arrives; everyone else just applies it. Per square, the last write wins (ADR 0002).
5. Cursor moves are shared with `presence/update` and shown as colored outlines.
6. If the connection drops, the client reconnects with exponential backoff (and abandons attempts that
   hang). It re-joins, receives a fresh snapshot, and re-sends any edits still pending.

Idle rooms cost nothing: the WebSocket Hibernation API lets the room leave memory while keeping
connections, and per-connection state lives in socket attachments.

## Decisions and open questions

Product decisions (no answer checking, sign-in to create puzzles, link-based editing, rooms kept
indefinitely, phone photos as a stretch goal) and the remaining open questions are tracked in
[`planning/design.md` §11](planning/design.md#11-decisions-and-open-questions).
