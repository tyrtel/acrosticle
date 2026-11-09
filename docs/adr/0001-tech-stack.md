# ADR 0001: Tech stack and repository structure

- **Status:** Accepted
- **Date:** 2026-11-09

## Context

We are building a collaborative, real-time acrostic solver that runs on Cloudflare. We want strong typing,
fast feedback, and the ability to share puzzle logic between the browser and the server.

## Decision

- **TypeScript (strict) everywhere.** We stay on TypeScript 6.0 for now because typescript-eslint does
  not yet support TypeScript 7. Upgrade once it does.
- **React 19 + Vite** for the front end. React is the most widely supported UI library, and Vite is the
  standard build tool for it.
- **Cloudflare Workers + Durable Objects** for real time. One Durable Object per room puts every update
  for a room through one place in a fixed order, with no separate pub/sub or database needed for live
  state. The WebSocket Hibernation API keeps idle rooms cheap.
- **npm workspaces monorepo** with `packages/core` (pure logic), `packages/protocol` (message contract),
  `apps/web` and `apps/worker`. Internal packages export TypeScript source directly, so there's no build
  step between them.
- **Zod** for runtime validation of every network message.
- **Vitest** for all unit and integration tests. React Testing Library covers the web app, and
  `@cloudflare/vitest-plugin` runs Worker tests inside the real `workerd` runtime. **Playwright** covers
  end-to-end tests.
- **Node 24 LTS.** Node 20 is end-of-life, and Vitest 5 and Wrangler need Node 22 or newer.

## Alternatives considered

- **Next.js / Remix:** server rendering adds complexity we don't need for an interactive single-page app.
- **Socket.io / a separate Node server:** more infrastructure to run; Durable Objects give per-room
  ordering out of the box.
- **pnpm:** a fine choice, but npm workspaces avoid installing an extra tool. Easy to switch later.

## Consequences

- Puzzle rules must live in `core` to be shared, and ESLint enforces that `core` has no platform
  dependencies.
- Worker tests run in `workerd`, so they're realistic but somewhat slower than Node tests.
