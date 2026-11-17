# ADR 0006: Multiple puzzle types (acrostics and crosswords)

- **Status:** Accepted (implemented 2026-11-17)
- **Date:** 2026-11-17

## Context

Crosswords get everything Acrosticle does for acrostics: real-time rooms, multi-letter entries,
highlights, undo, phone typing, focus cues, My puzzles, sign-in, importing and Copy to Sheet. The plan
and the decisions behind it are in [docs/planning/crosswords.md](../planning/crosswords.md). A code
run-through found that most of the code didn't depend on the puzzle type: the solve state, the
protocol, the room server, client sync, accounts and the typing machinery all work on cell numbers.

## Decision

**One repository, one codebase, two sites.**

- **Packages by puzzle type.** `packages/core` keeps what every puzzle type shares (entries, solve
  state, undo history, highlights, `CellNumber`). `packages/acrostic` holds the acrostic model, format,
  validation and navigation (moved out of core). `packages/crossword` holds the crossword model, the
  .puz/.ipuz/JSON formats, numbering, validation and across/down navigation. Both import only core
  (lint-enforced).
- **A crossword square's cell number is its position** (row × width + column + 1). Printed numbers
  are display data. So the solve state, `cell/set`, `cell/mark`, undo, presence and the room's
  storage are unchanged.
- **Puzzle files carry a `kind`.** `PuzzleFile` is a union of `AcrosticFile` (no `kind` needed, so
  stored rooms and old exports still read) and `CrosswordFile` (`"kind": "crossword"`). The server
  looks inside a puzzle in one place, `apps/worker/src/puzzleKinds.ts`, to validate it and learn its
  cell numbers. Crossword answers are stored but never sent to browsers (`publicPuzzleFile`).
- **A shared solver shell.** `apps/web/src/components/SolverShell` owns the hidden input,
  phone/IME typing, multi-letter mode, undo/redo, highlights, focus and the toolbar. Each puzzle type
  gives it a `SolverModel` (how typing and keys move its cursor) and draws its own grid and clues.
- **Two deployments of one Worker and one web app.** Acrosticle (`acrosticle.tyrtel.workers.dev`) and
  Crosswordicle (`crosswordicle.tyrtel.workers.dev`, `wrangler deploy --env crossword`, web built with
  `VITE_SITE=crossword`). Each has its own rooms (Durable Object namespace) and accepts only its kind.
  They **share the D1 database** (one set of accounts, one My puzzles list linking each room to its
  site) and **one sign-in**: the session cookie is set for `tyrtel.workers.dev` (the Public Suffix List
  lists `workers.dev`, so that's one site), and Crosswordicle hands Google sign-in to Acrosticle, which
  sends people back (to one of the two known origins only).

## Alternatives

- **A second repository:** faster to start, but every fix (e.g. the Android typing fix) would have to
  be ported by hand forever.
- **One site serving both types:** the least infrastructure, but the user wanted separate sites.
  The code supports either; only the deployment settings differ.
- **Nested addresses (`acrosticle.gridicles.tyrtel.workers.dev`):** not possible on workers.dev. A
  custom domain can still be put in front of both later.

## Consequences

- The session cookie was renamed (`gridicles_session`) when it became shared, so everyone signs in
  once more.
- Deploys build the web app twice and deploy two Workers (`npm run deploy` does both and smoke-tests
  both).
- Crossword check/reveal is deferred; answers are already kept on the server for it.
- Local development runs each site separately (`npm run dev`, `npm run dev:crossword`).
