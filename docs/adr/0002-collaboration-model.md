# ADR 0002: Collaboration model

- **Status:** Accepted (implemented in M3, 2026-11-09)
- **Date:** 2026-11-09

## Context

Several users edit the same puzzle at once. Acrostic solve state is a map of `cell number → letter`, and
each cell is independent of the others. There's no ordered text to merge.

## Proposal

**The server decides the order, and the last write to a cell wins.**

- The `PuzzleRoom` Durable Object holds the authoritative solve state.
- A client applies its own edit immediately (optimistically) and sends `cell/set`.
- The room applies edits in the order they arrive, stores them, and broadcasts `cell/updated`.
- A client that joins or reconnects gets a full snapshot, then live updates.
- A per-room version number lets clients detect gaps and resync.

## Why not CRDTs (Yjs, Automerge)?

CRDTs earn their keep for merging ordered sequences (text) or for offline-first editing. Here the
state is a flat map edited online through one ordering point, so per-cell last-write-wins gives the
same result for users with far less complexity. We can revisit if offline solving becomes a requirement.

## Open points

- Whether a letter checked as correct can be overwritten by someone else
- Showing who typed what (per-cell author colours)
- Undo semantics in a shared session
