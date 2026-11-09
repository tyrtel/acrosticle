# Features

One folder per user-facing feature (e.g. `puzzle/`, `room/`, `lobby/`). Each feature owns its
components, hooks, and tests, and exposes a small public API through its own `index.ts`.

Features may import from `src/components`, `src/hooks`, `src/lib`, and the `@acrosticle/*`
packages, but **not from each other's internals**. If two features need the same code, move it
to a shared location.
