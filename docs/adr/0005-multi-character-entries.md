# ADR 0005: Multi-character entries

- **Status:** Accepted (2026-11-12)
- **Date:** 2026-11-12

## Context

A square holds exactly one character today (`Entry` in `packages/core/src/entries.ts`). Solvers want to
put several characters in a square, either because the puzzle calls for it (the puzzle never says which
squares) or as a solving aid ("E or I"). See [F5 in features.md](../planning/features.md#f5-multi-character-entries).

`Entry` is the contract for every square's value: the protocol validates it on both sides, the room
filters stored values with it, and the UI assumes one character when typing and drawing.

## Decision

1. **`Entry` becomes 1 to 100 characters** (graphemes, after NFC normalization and trimming). Allowed:
   letters, digits, punctuation and symbols, plus single spaces between them. No leading/trailing
   spaces, no runs of spaces, no control characters. Case is kept.
   - 100 is a safety bound for the server and other solvers, not a UI limit: far beyond real use,
     small enough that a hostile client can't bloat a room. It's checked in `core`, so the browser and
     the Durable Object agree.
   - Normal typing still produces one character per square. Only multi-letter mode produces longer
     entries.
2. **The protocol version is announced on connect.** The client opens the room WebSocket with
   `?v=2`. A client without it is a tab loaded before this change ("v1").
3. **v1 clients are kept working and told to reload.** On join, the room sends a v1 client an `error`
   message ("This page is out of date. Reload to keep solving."), which v1 already displays. In its
   snapshots and updates, multi-character entries are cut to their first character, so v1 still
   parses them instead of silently dropping the whole snapshot. v1 can only send single characters,
   which are still valid.
4. **The acrostic uses the first character** of the first square of each answer.

## Alternatives considered

- **Unbounded entries:** simplest to explain, but any link holder could push megabytes into a square
  that every solver then downloads. Rejected; the bound is invisible in practice.
- **A separate "notes" field per square** for guesses, alongside the real entry: cleaner semantics,
  but two values per cell to sync, display and undo, against architecture rule 4 (one source of
  truth). Users decide what a multi-character entry means. Rejected for now.
- **Puzzle-declared multi-character squares:** the puzzles don't mark them, and solvers also want this
  for guesses. Rejected.
- **No compatibility for stale tabs:** a v1 tab receiving a multi-character snapshot would ignore it
  and appear frozen. The downgrade costs a few lines in the room. Rejected.

## Consequences

- `isEntry` / `normalizeEntry` change meaning; every caller is reviewed (keymap, text input,
  composition, protocol, room storage).
- Stored rooms need no migration: every existing value is a valid new `Entry`.
- The v1 compatibility path can be removed once old tabs are gone (a few weeks after deploy); the
  `?v=` parameter stays for future changes.
