# Acrosticle

Solve **acrostic puzzles** together, in real time.

Open a puzzle, share the link, and everyone in the room sees each other's letters as they're typed.
Filling a clue answer fills the matching squares in the quote grid, and vice versa.

> **Status:** early scaffolding. Features and requirements are being defined in
> [`docs/planning/`](docs/planning/).

## Tech stack

- **Front end:** React 19, TypeScript, Vite
- **Real-time back end:** Cloudflare Workers + Durable Objects (WebSockets)
- **Shared code:** `@acrosticle/core` (puzzle logic) and `@acrosticle/protocol` (message schemas, Zod)
- **Testing:** Vitest, React Testing Library, Cloudflare's Vitest plugin (tests run in `workerd`), Playwright

## Getting started

### Prerequisites

- Node.js **24 LTS** (see `.nvmrc`; with nvm: `nvm install && nvm use`)
- npm 11+ (bundled with Node 24)
- A Cloudflare account only when you want to deploy. Local development needs none.

### Install and run

```bash
npm install
npm run dev
```

- Web app: <http://localhost:5173>
- Worker: <http://localhost:8787> (API only; the web dev server proxies `/api` and WebSockets to it)
- Health check: <http://localhost:5173/api/health>

To try solving together, click **Try the sample puzzle**, then open the room's link in a second browser
window (or a private window, which gets its own name).

The sample needs no account. Importing your own puzzles needs Google sign-in with an allowlisted email.
To enable sign-in locally, copy `apps/worker/.dev.vars.example` to `apps/worker/.dev.vars` (git-ignored)
and fill in the Google OAuth client and your email; see
[`docs/setup/google-sign-in.md`](docs/setup/google-sign-in.md). Without it, everything except sign-in
works, and Wrangler warns about the missing secrets.

`npm run dev` applies the local database migrations (Cloudflare D1) before starting the Worker.

### Image parsing (optional locally)

"Upload a puzzle image" needs an Anthropic API key and costs money per image. See
[`docs/setup/claude-api.md`](docs/setup/claude-api.md): in short, `npm run setup:claude`, restart
`npm run dev`, and `npm run doctor:claude` to check.

### Google sign-in (optional locally)

Without sign-in configured, everything works except creating rooms for imported puzzles. To enable it,
follow [`docs/setup/google-sign-in.md`](docs/setup/google-sign-in.md): in short, `npm run setup:signin`,
restart `npm run dev`, then `npm run doctor:signin` to check.

## Scripts

| Command                    | Description                                                  |
| -------------------------- | ------------------------------------------------------------ |
| `npm run dev`              | Run web + worker locally                                     |
| `npm run build`            | Production build of the web app                              |
| `npm test`                 | All unit and integration tests                               |
| `npm run test:unit`        | Unit tests only                                              |
| `npm run test:integration` | Integration tests only                                       |
| `npm run test:coverage`    | Tests with a coverage report (`coverage/`)                   |
| `npm run test:e2e`         | Playwright end-to-end tests                                  |
| `npm run typecheck`        | Type-check every workspace                                   |
| `npm run lint`             | Lint                                                         |
| `npm run format`           | Format with Prettier                                         |
| `npm run setup:signin`     | Write local Google sign-in secrets (`apps/worker/.dev.vars`) |
| `npm run doctor:signin`    | Check the local sign-in setup                                |
| `npm run setup:claude`     | Write the local Anthropic API key (`apps/worker/.dev.vars`)  |
| `npm run doctor:claude`    | Check the local image-parsing setup (no API call)            |
| `npm run eval:parse`       | Measure parser accuracy and cost (real API; needs `--yes`)   |
| `npm run check`            | Everything CI runs (typecheck, lint, format, test)           |

The first time you run end-to-end tests, install a browser: `npx playwright install chromium`. The
e2e tests start their own servers on ports 5174 and 8788, so they work even while `npm run dev` is running.

## Project structure

```
apps/
  web/        React front end
  worker/     Cloudflare Worker + PuzzleRoom Durable Object
packages/
  core/       Pure acrostic domain logic (no I/O, no framework)
  protocol/   WebSocket message schemas shared by web and worker
tests/
  e2e/        Playwright tests
  fixtures/   Shared test data
docs/
  architecture.md
  adr/        Architecture Decision Records
  planning/   Features, requirements, roadmap
```

Unit tests sit beside the code they test (`foo.ts` → `foo.test.ts`). Integration tests live in each
workspace's `tests/integration/` folder. See [`CLAUDE.md`](CLAUDE.md) for the full engineering and testing
standards.

## Deployment

The Worker deploys with Wrangler:

```bash
npx wrangler login
npm run deploy -w @acrosticle/worker
```

Hosting for the web app (Workers static assets or Cloudflare Pages) is still to be decided. See
[`docs/adr/`](docs/adr/).

## Contributing

1. Read [`CLAUDE.md`](CLAUDE.md) and [`docs/architecture.md`](docs/architecture.md).
2. Branch from `main`; keep changes small and focused.
3. Add tests with your change.
4. Make sure `npm run check` passes before opening a PR.

## License

TBD.
