# CLAUDE.md

Guidance for Claude (and any other contributor) working in this repository. Read this before writing code.

## Project

**Acrosticle** is a web app for solving **acrostic puzzles** together in real time. Several people open
the same puzzle "room" and see each other's entries instantly.

How an acrostic works: a quotation is hidden in a numbered grid. Each clue's answer is written in
numbered blanks, and every numbered blank corresponds to exactly one grid square. The first letters of
the clue answers, read in order, spell out the author and/or title of the quote. Filling in a letter in a
clue fills the matching grid square, and vice versa.

Planning documents live in `docs/planning/`. Architecture decisions live in `docs/adr/`. **Check both
before starting a feature**, and update them when a decision changes.

## Tech stack

| Concern                 | Choice                                                                                             |
| ----------------------- | -------------------------------------------------------------------------------------------------- |
| Language                | TypeScript (strict), everywhere                                                                    |
| Front end               | React 19 + Vite                                                                                    |
| Real-time / back end    | Cloudflare Workers + Durable Objects (one `PuzzleRoom` object per room, WebSocket Hibernation API) |
| Wire format             | JSON messages validated with Zod (`@acrosticle/protocol`)                                          |
| Unit + integration test | Vitest; React Testing Library (web); `@cloudflare/vitest-plugin` (worker, runs in real `workerd`)  |
| End-to-end test         | Playwright                                                                                         |
| Lint / format           | ESLint (typed, flat config) + Prettier                                                             |
| Runtime                 | Node 24 LTS (`.nvmrc`), npm workspaces                                                             |

Don't add a new dependency without a clear reason. Prefer the platform and existing deps. When you do add
one, say why in the PR/commit, and record significant choices as an ADR.

## Repository layout

```
apps/
  web/                 React app (Vite)
    src/
      features/<name>/ One folder per user-facing feature (components, hooks, tests, index.ts)
      components/      Shared presentational components
      hooks/           Shared hooks
      lib/             Shared non-React helpers (e.g. WebSocket client)
      test/setup.ts    Test setup (jest-dom matchers, cleanup)
    tests/integration/ Multi-component / feature-flow tests (jsdom)
  worker/              Cloudflare Worker
    src/index.ts       Entry point; exports the Durable Object classes
    src/router.ts      HTTP routing (keep thin)
    src/room/          PuzzleRoom Durable Object
    tests/integration/ Tests run inside workerd against the real Worker + DOs
    wrangler.jsonc     Worker config. Run `npm run cf-typegen -w @acrosticle/worker` after editing it
packages/
  core/                Pure domain logic: puzzle model, solve state, validation. NO I/O, React or Cloudflare.
  protocol/            Client <-> server message schemas and parse/encode helpers
tests/
  e2e/                 Playwright tests against the full running app
  fixtures/            Shared test-only data
samples/
  puzzles/             Public-domain sample puzzles (used by the app and as golden fixtures)
docs/
  architecture.md      System overview
  adr/                 Architecture Decision Records
  planning/            Features, requirements, roadmap
```

## Architecture rules

1. **Dependency direction is one-way:** `core` ← `protocol` ← `web` / `worker`. `core` imports nothing
   internal (enforced by ESLint). `web` and `worker` never import from each other.
2. **Business logic goes in `packages/core`.** It is pure, deterministic and side-effect free, so the
   browser and the Durable Object can run the _same_ code. If you're writing puzzle rules inside a React
   component or a Durable Object, move them to `core`.
3. **The protocol package is the only contract** between client and server. Every message crossing the
   network is defined there and validated **on receipt, on both sides**. Never `JSON.parse(...) as X`.
4. **The cell number is the single source of truth** for solve state. Grid and clue views are both
   projections of one `SolveState`; never keep two copies that have to be synced.
5. **Keep edges thin.** React components render and dispatch; Worker handlers route and delegate. Logic in
   either is a smell.
6. **Immutable state updates.** Domain functions return new values. No mutation of inputs.
7. **Features are self-contained.** A feature exposes a small public API via its `index.ts`. Features don't
   reach into each other's internals; shared code moves to `components/`, `hooks/`, `lib/` or a package.

## Engineering standards — work like a senior engineer

- **Understand before changing.** Read the surrounding code, the relevant ADRs and planning docs first.
  Match existing patterns. If a pattern is wrong, propose changing it everywhere instead of adding a
  second way.
- **Reuse, don't duplicate.** Search for an existing helper/type/component before writing one. Extract a
  shared abstraction on the second real use, not speculatively. But don't over-abstract: three
  similar lines beat a premature framework.
- **Small, focused units.** Functions do one thing; files have one responsibility. Prefer composition over
  inheritance (Durable Object classes are the exception the platform requires).
- **Types are design.** Model the domain precisely: branded types (`Letter`), discriminated unions,
  exhaustive `switch` (lint-enforced). No `any`, no non-null `!` in production code without a comment
  saying why it's safe. Validate at boundaries, trust types inside.
- **Explicit error handling.** Handle expected failures as values (e.g. `ParseResult`); throw only for
  programmer errors/invariant violations. Never swallow errors silently. Explain any empty `catch`.
- **Names over comments.** Comments explain _why_, not _what_. Public functions in `core`/`protocol` get a
  short doc comment.
- **No dead code, no commented-out code, no stray `console.log`.** `TODO`s reference a planning item.
- **Security by default.** Treat all client input as hostile (validate, bound sizes, rate-limit when we add
  it). No secrets in the repo; use `.dev.vars` / Wrangler secrets.
- **Accessibility is a requirement**, not a polish step: keyboard navigation for the grid, semantic
  markup, ARIA where needed, visible focus, sufficient contrast. Puzzle solving is keyboard-heavy.
- **Performance awareness.** The grid can have hundreds of cells and frequent remote updates. Avoid
  re-rendering the whole grid per keystroke; memoize deliberately, measure before optimizing.

## Testing policy

Tests are part of the feature, not follow-up work. **A change without tests is not done.**

| Level       | Where                                        | What                                                                                                               |
| ----------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Unit        | Next to the source: `foo.ts` → `foo.test.ts` | Every module in `core` and `protocol`; hooks, components, helpers in `web`; pure helpers in `worker`               |
| Integration | `<workspace>/tests/integration/`             | Worker routes + Durable Object behaviour over real WebSockets in `workerd`; multi-component feature flows in `web` |
| End-to-end  | `tests/e2e/`                                 | A few critical journeys only (create room, two users solve together, reconnect)                                    |

Rules:

- **Write the test first or alongside the code** (TDD encouraged, especially in `core`).
- **Test behaviour, not implementation.** In React, query by role/label/text (Testing Library), interact
  with `user-event`, and avoid testing internal state or snapshot-everything.
- **Cover the edges:** invalid input, empty states, boundaries, concurrent/conflicting updates, disconnects.
- Use `it.each` for tables of cases. Keep tests deterministic: no real timers, network or randomness
  without control (`vi.useFakeTimers`, fixtures, seeded data).
- Use the sample puzzles in `samples/puzzles/`; don't hand-build big puzzles inline in tests.
- Coverage thresholds are 80% across the board (in `vitest.config.ts`); `core` and `protocol` should
  stay close to 100%. Don't game coverage with assertion-free tests.
- A bug fix starts with a failing test that reproduces the bug.

## Commands

Use Node 24 (`nvm use`). Run from the repo root.

| Command                         | Purpose                                                                               |
| ------------------------------- | ------------------------------------------------------------------------------------- |
| `npm install`                   | Install all workspaces                                                                |
| `npm run dev`                   | Vite (http://localhost:5173) + `wrangler dev` (:8787), `/api` proxied                 |
| `npm test`                      | All Vitest projects (unit + integration)                                              |
| `npm run test:unit`             | Unit tests only                                                                       |
| `npm run test:integration`      | Integration tests only                                                                |
| `npm run test:coverage`         | Tests with coverage + thresholds                                                      |
| `npm run test:e2e`              | Playwright, on its own ports 5174/8788 (first run: `npx playwright install chromium`) |
| `npm run typecheck`             | `tsc --noEmit` everywhere                                                             |
| `npm run lint` / `lint:fix`     | ESLint                                                                                |
| `npm run format`                | Prettier write                                                                        |
| `npm run check`                 | typecheck + lint + format check + tests — **run before declaring work done**          |
| `npx vitest run --project core` | Run a single project (`core`, `protocol`, `web`, `worker`)                            |

## Definition of done

- [ ] Behaviour matches the requirement in `docs/planning/` (or the requirement was updated)
- [ ] Unit tests for new logic; integration tests for new cross-boundary behaviour; e2e if a critical journey changed
- [ ] `npm run check` passes with no new warnings
- [ ] No duplicated logic; shared code is in the right layer
- [ ] Docs/ADRs updated if architecture, protocol, or commands changed
- [ ] Protocol changes are backwards-compatible or the change is called out explicitly

## Working agreements for Claude

- For anything non-trivial, **outline the plan first** (files touched, approach, tests) and confirm
  before writing large amounts of code.
- Work in small, reviewable increments. Keep each change on one topic.
- When requirements are ambiguous, ask rather than guess. When you make an assumption, state it.
- Report honestly: if tests fail, something is skipped, or a shortcut was taken, say so.
- Commit messages: imperative mood, concise subject (≤72 chars), body explains _why_.
