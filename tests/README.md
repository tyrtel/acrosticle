# Cross-cutting tests

| Folder      | What lives here                                                      |
| ----------- | -------------------------------------------------------------------- |
| `e2e/`      | Playwright end-to-end tests run against the full app (web + worker). |
| `fixtures/` | Shared test data, e.g. sample puzzles in `fixtures/puzzles/*.json`.  |

Unit and integration tests live **inside each workspace**:

- Unit tests sit next to the code they test: `foo.ts` → `foo.test.ts`.
- Integration tests go in `<workspace>/tests/integration/`.
