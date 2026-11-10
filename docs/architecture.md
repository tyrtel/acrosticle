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

| Method and path                 | Purpose                                                                                                                            |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/health`               | Liveness check                                                                                                                     |
| `POST /api/rooms`               | Create a room: `{ sample: "diplo-crostic-37" }` (anyone) or `{ puzzle }` (signed-in, allowlisted; validated). Returns `{ roomId }` |
| `GET /api/rooms/:id`            | Check a room exists before joining; `{ roomId, title }` or 404                                                                     |
| `GET /api/rooms/:id/ws`         | WebSocket upgrade into the room                                                                                                    |
| `GET /api/auth/google`          | Start Google sign-in (`?returnTo=/path`)                                                                                           |
| `GET /api/auth/google/callback` | Google returns here; sets the session cookie                                                                                       |
| `POST /api/auth/logout`         | End the session                                                                                                                    |
| `GET /api/me`                   | `{ user, canCreate, signInConfigured }`; extends an ageing session                                                                 |
| `GET /api/me/rooms`             | Rooms the signed-in user created, newest first                                                                                     |

Room ids are 128 random bits (22 base64url characters). The link is the access control for solving.

## Sign-in and accounts (ADR 0003)

- **Flow:** OAuth 2.0 authorization code + PKCE + `state`, written directly in `apps/worker/src/google.ts`
  and `authRoutes.ts`. The state, PKCE verifier and return path ride in a short-lived `HttpOnly` cookie
  scoped to `/api/auth`.
- **Sessions:** a random 32-byte token in an `HttpOnly; Secure; SameSite=Lax` cookie; D1 stores only its
  SHA-256 hash. 30 days, extended by `/api/me` once under 15 days remain.
- **D1 (`DB` binding, `apps/worker/migrations/`):** `users`, `sessions`, and `rooms` (every room, with
  its creator if signed in).
- **Who can do what:** anyone can start a sample room or join any room by link; only signed-in users whose
  email is in the `CREATOR_ALLOWLIST` secret can create rooms for their own puzzles.
- **Configuration:** `APP_ORIGIN` and `GOOGLE_CLIENT_ID` are vars in `wrangler.jsonc`;
  `GOOGLE_CLIENT_SECRET` and `CREATOR_ALLOWLIST` are secrets (`.dev.vars` locally). Without Google
  credentials, sign-in is reported as not set up and everything else still works.
- POSTs whose `Origin` isn't `APP_ORIGIN` are rejected.

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

## Known issues

- **Local Durable Object stalls.** In local development (`wrangler dev` on WSL), a request to a room
  occasionally takes several seconds (once about 40 s) instead of milliseconds, mostly soon after the
  servers start. The room's own code is synchronous, so the delay is in the local runtime. Browser tests
  warm up the servers and retry once locally to absorb it. To confirm after each deploy: room requests on
  Cloudflare stay fast (`npm run smoke`).

## Decisions and open questions

Product decisions (no answer checking, sign-in to create puzzles, link-based editing, rooms kept
indefinitely, phone photos as a stretch goal) and the remaining open questions are tracked in
[`planning/design.md` §11](planning/design.md#11-decisions-and-open-questions).
