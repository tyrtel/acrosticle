# Acrosticle: Design Document

- **Status:** Draft. Product decisions recorded 2026-11-09 (§11)
- **Date:** 2026-11-09
- **Related:** [architecture.md](../architecture.md), [ADR 0001](../adr/0001-tech-stack.md), [ADR 0002](../adr/0002-collaboration-model.md)

## 1. Summary

Acrosticle lets a group of people solve an acrostic puzzle together in real time. A signed-in user uploads
a scan or screenshot of a printed acrostic. Claude (via the Anthropic API) reads the image and extracts the
quotation grid, the clues, and the mapping between clue-answer blanks and grid squares. The user reviews and
corrects the result, then shares a link. Anyone with the link can join and edit, no sign-in
needed. Everyone in the room can type into **either** the grid **or** the
clue answers, and the matching square in the other view updates instantly for everyone.

## 2. Goals and non-goals

### Goals

1. **Image → playable puzzle.** Turn a scan or screenshot of a standard printed acrostic into a
   structured, validated puzzle with minimal manual correction. Phone photos are a stretch goal (§6.8).
2. **Two-way entry.** Typing a letter in a clue blank fills the linked grid square, and typing in a grid
   square fills the linked clue blank.
3. **Real-time collaboration.** Several people in one room see each other's entries within a fraction of a
   second, including after reconnects.
4. **Trustworthy parsing.** Every parse is checked automatically, and problems are shown to the user.
   A bad parse is never silently accepted.
5. **Keyboard-first, accessible solving** on desktop, usable on mobile.
6. **Rooms last indefinitely.** A room and its progress stay available for as long as the service runs.
7. **Affordable parsing.** Keep cost per parse as low as quality allows, decided from measured results
   (§6.5).

### Non-goals (for the first version)

- **Checking answers.** Decided: no answer checking. Printed puzzles usually don't include a solution
  (the sample doesn't), and solvers judge correctness themselves.
- **Phone-photo capture in v1.** A stretch goal. The design keeps it possible (§6.8), but it isn't built
  in the first version.
- Constructing new acrostics.
- A public puzzle library or sharing copyrighted puzzles publicly. Rooms are private and reached by link.
- Offline solving.

## 3. Background: how an acrostic works

Summarized from [Wikipedia: Acrostic (puzzle)](<https://en.wikipedia.org/wiki/Acrostic_(puzzle)>) and the
sample puzzle.

- **Two parts:** a set of **lettered clues** (A, B, C, …), each with a row of **numbered blanks** for its
  answer, and a **quotation grid** of numbered squares.
- **The mapping:** each blank number under a clue is the number of a grid square. Writing the answer to
  clue A into its blanks (e.g. blanks `8 5 17 2 14` for JAPAN) puts J, A, P, A, N into grid squares 8, 5, 17,
  2 and 14. Solvers work back and forth: partial words in the grid suggest clue answers, and clue answers fill
  the grid.
- **Clue letters in the grid:** each grid square's number is usually followed by the clue letter it belongs
  to (e.g. `2E`), so solvers can jump from grid to clue.
- **The acrostic:** in most forms, the first letters of the answers, read A→Z, spell the author and title
  of the source of the quotation.
- **Word breaks:** black squares (or gaps) separate words in the quotation. The grid reads left to right,
  top to bottom, and lines wrap without regard to word boundaries.
- **Names:** double-crostic, anacrostic, Duo-Crostic, Diplo-Crostic and others are names for the same core
  mechanics.

### The sample puzzle

[Diplo-Crostic No. 37, _State_ magazine, July 1986](<https://en.wikipedia.org/wiki/File:Acrostic_puzzle_-_State_1986-07-_Iss_291_(IA_sim_state-magazine_1986-07_291)_(page_39_crop).jpg>)
(1853×2515 px, grayscale scan, 300 dpi). What it tells us about real input:

| Observation                                                                               | Design consequence                                                                                                |
| ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Grid is **20 columns × 14 rows**: 232 numbered squares plus black squares.                | The model must support arbitrary grid sizes. Store the column count and the squares in reading order.             |
| Every square shows **number + clue letter**, e.g. `1O`, `2E`, `26A`.                      | A free cross-check: the label on square _n_ must match the clue whose blanks contain _n_ (§6.4).                  |
| 26 clues, **A–Z**, split into two columns ("DEFINITIONS" / "WORDS").                      | Clue labels can't be assumed to fit in A–Z (big puzzles use AA, BB…). `clueLabel()` in core already handles this. |
| Long answers **wrap onto a second line** of blanks (D, I, J, P, V, W, Y, M).              | The parser must join wrapped blanks into one ordered list. A common place for parse errors.                       |
| **Cross-referenced clues:** G "With WORD M, story of Helena and Bertram", M "See WORD G". | Clue text is free text. The model doesn't need to understand it, but the UI should render it faithfully.          |
| Scan artifacts and look-alike glyphs: `O`/`0`/`Q`/`D`, `I`/`1`/`l`, stray marks.          | Expect character-level errors. Validation catches most of them, and the review UI fixes the rest.                 |
| Title, author ("By Carol Becker") and directions text around the puzzle.                  | Extract title and constructor (`constructedBy`) as optional metadata and ignore the directions.                   |
| No punctuation squares in this grid.                                                      | Support optional non-letter squares (punctuation) in the model anyway; other publishers use them.                 |

**The original contains a misprint.** Square 193 is printed `193Y`, but cell 193 appears only in clue V,
and the clue lengths confirm V (12 blanks for TWELFTH NIGHT; Y has 11 for REDWOOD CITY). So:

- The parser must transcribe **what's printed**, not silently "fix" it, and validation (V4) must flag it.
- The review screen must make fixing such issues quick, and the issue message should suggest the likely fix
  ("193 belongs to clue V; change the label to V?").
- The golden fixture stores the corrected puzzle plus an `errata` entry, so tests can rebuild the as-printed
  version.

Sanity check from the sample: clue A, "Daughter to Brabantio", has 9 blanks, and DESDEMONA has 9 letters.

## 4. User flows

### 4.1 Create a room from an image

1. User **signs in** (required to create puzzles; see §7.4), then chooses **New puzzle → Upload image**
   (file picker; camera capture is the phone-photo stretch goal).
2. The browser downscales the image if needed (§6.2) and uploads it.
3. A progress state ("Reading puzzle…") is shown. Parsing takes tens of seconds.
4. The **review screen** shows the extracted grid and clues side by side, with any validation issues
   highlighted (e.g. "Square 117 is labelled I, but no clue I contains 117").
5. The user fixes issues inline, either by editing a square's number or label, or a clue's text or blank
   list. Validation re-runs on each edit.
6. Once there are no blocking errors, the user clicks **Start solving**. A room is created and the user gets a
   shareable link.

### 4.2 Fallback: manual entry or JSON import

The same review/editor screen, starting empty (or from pasted JSON). This guarantees the app is usable
when parsing fails, and it lets us build and test the solver before the parser exists.

### 4.3 Solve together

1. Anyone with the link opens it, chooses a display name, and joins. **No sign-in is needed to join**,
   and everyone in the room can edit any square.
2. They see the current state immediately, then live updates.
3. Each person sees the others' selected squares (presence) in their own colour.

## 5. Domain model (`packages/core`)

The cell number is the single source of truth (architecture rule 4). The puzzle definition is immutable once
a room is created. Solve state is a separate map.

```ts
type CellNumber = number; // 1..N, the printed square number
type ClueLabel = string; // "A", "B", …, "AA"

interface Puzzle {
  title?: string; // "Diplo-Crostic No. 37"
  constructedBy?: string; // "Carol Becker"
  source?: string; // "State, July 1986"
  grid: Grid;
  clues: Clue[]; // in label order
}

interface Grid {
  columns: number; // 20 for the sample
  squares: GridSquare[]; // reading order, row by row, length = rows × columns
}

type GridSquare =
  | { kind: 'letter'; number: CellNumber; clue: ClueLabel }
  | { kind: 'block' } // black square / word break
  | { kind: 'punctuation'; char: string }; // printed punctuation, if the publisher uses it

interface Clue {
  label: ClueLabel;
  text: string; // "Daughter to Brabantio"
  cells: CellNumber[]; // answer blanks in order: [138, 5, 44, 232, …]
}

// Already in core: SolveState = Readonly<Record<CellNumber, Letter>>
```

**Derived index** (`buildPuzzleIndex(puzzle)`), computed once per puzzle:

- `cellToGridIndex: Map<CellNumber, number>`: where a cell sits in the grid
- `cellToClue: Map<CellNumber, { clue: ClueLabel; position: number }>`: which clue blank a cell is
- `wordAt(gridIndex)`: the run of letter squares between blocks, used for grid-word highlighting

### Two-way entry

Because both views read from the same `SolveState`, "syncing" is just a lookup:

- **Typing in a clue:** clue `A`, position 1 → `cells[1]` = 5 → `setCell(state, 5, 'E')`.
- **Typing in the grid:** square 5 → `setCell(state, 5, 'E')`.
- **Both views re-render from state.** Clue A's blank 1 and grid square 5 both read `state[5]`, so they can
  never disagree.

Cursor behaviour (pure functions in core, so they can be unit tested):

- Selecting a grid square highlights its clue blank and the clue, and vice versa.
- After typing, the cursor advances within the **active view**: next letter square in the grid (skipping
  blocks), or next blank in the clue.
- Backspace clears the current square, or moves back and clears it if the square is already empty.
- Arrow keys move in the grid. Tab / Shift+Tab move between clues. Typing a letter overwrites.

## 6. Image parsing pipeline

> **Status (2026-11-10): built (M5).** Implemented as described below, with these differences:
> the response uses the compact puzzle-file shape (grid rows as strings) instead of one object per
> square, to cut output tokens; model and effort are Worker settings (`PARSE_MODEL`, `PARSE_EFFORT`;
> defaults Opus 5.5 / high) to be chosen after the cost review; refusal fallbacks are sent only to
> models that accept them; the repair pass (§6.3) is not built. Spending limits: 10 parses per person
> per hour and `PARSE_DAILY_BUDGET_USD` per UTC day (default $5), all runs logged in `parse_runs`.
> See [ADR 0004](../adr/0004-image-parsing.md) and [setup](../setup/claude-api.md). The cost review
> (`npm run eval:parse`, $4 total budget, cheapest model first) is pending the owner's go-ahead.

### 6.1 Flow

```
Browser                         Worker  POST /api/puzzles/parse            Anthropic API
───────                         ───────────────────────────────            ─────────────
pick image
downscale (≤2576px long edge)
upload (multipart) ───────────▶ require signed-in user; check type/size;
                                per-user rate limit
                                build request: image + extraction prompt
                                + JSON schema ────────────────────────────▶ Claude Opus 5.5 (vision,
                                                                            structured output)
                                ◀──────────────────────── RawExtraction JSON
                                validate with Zod (protocol)
                                normalize → Puzzle draft (core)
                                validatePuzzle() → issues[] (core)
◀───────────── { draft, issues }
review / correct
POST /api/rooms { puzzle } ───▶ final validatePuzzle(); create PuzzleRoom
◀───────────── { roomId }
```

The parse endpoint is **stateless** and returns a draft. Nothing is stored until the user confirms. The
uploaded image is not kept by default.

### 6.2 Claude API request

Use the official `@anthropic-ai/sdk`. It's fetch-based and runs in Workers. Settings, from the current
Claude API reference:

| Setting           | Value                                                                                                        | Why                                                                                                                                     |
| ----------------- | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| Model             | `claude-opus-5-5`                                                                                            | Current default model. Strong vision, supports high-resolution images (up to 2576 px on the long edge).                                 |
| Image             | Base64 JPEG/PNG/WebP, downscaled in the browser so the long edge is ≤2576 px                                 | Small grid digits need resolution. Don't downscale further by default. Measure first.                                                   |
| Output            | Structured outputs: `client.messages.parse()` + `output_config.format: zodOutputFormat(RawExtractionSchema)` | Guaranteed schema-shaped JSON with no fragile text parsing.                                                                             |
| Thinking / effort | Adaptive thinking (always on for this model). `output_config.effort: "high"`                                 | Dense transcription with cross-checking rewards effort. The default is `medium`, so set it explicitly and tune it with the eval (§9.3). |
| `max_tokens`      | ~64000, **streaming** with `.finalMessage()`                                                                 | The output is long (hundreds of squares) and thinking adds more. Streaming avoids HTTP timeouts.                                        |
| Refusal fallback  | `fallbacks: "default"` + beta `server-side-fallback-2026-07-01`                                              | Recommended default for this model. Always check `stop_reason` (`refusal`, `max_tokens`) before using output.                           |
| Prompt caching    | `cache_control` on the stable system prompt                                                                  | The instructions are identical on every call, so caching cuts repeat input cost.                                                        |
| API key           | Worker secret `ANTHROPIC_API_KEY` (`wrangler secret put`). Locally in `.dev.vars`                            | The key never reaches the browser.                                                                                                      |

**Extraction schema** (`RawExtraction`, in `packages/protocol`). This is a deliberately literal
transcription of what's printed. The model is asked to _read_, not to solve:

```ts
const RawExtractionSchema = z.object({
  title: z.string().nullable(),
  constructedBy: z.string().nullable(),
  gridColumns: z.number().int(),
  gridRows: z.array(
    z.array(
      z.union([
        z.object({ kind: z.literal('letter'), number: z.number().int(), clue: z.string() }),
        z.object({ kind: z.literal('block') }),
        z.object({ kind: z.literal('punctuation'), char: z.string() }),
      ]),
    ),
  ),
  clues: z.array(
    z.object({
      label: z.string(),
      text: z.string(),
      cells: z.array(z.number().int()), // all blanks, wrapped lines joined in order
    }),
  ),
  notes: z.array(z.string()), // anything the model was unsure about
});
```

Structured outputs don't support numeric or length constraints (`min`, `max`, etc.). The SDK strips them
and validates them client-side. Our own `validatePuzzle()` is the real gate either way.

**Prompt outline.** Keep it short; current models need little scaffolding:

- The image is a printed acrostic. Transcribe it exactly as printed. Do not solve it.
- Grid: row by row, left to right. Each square is a numbered letter square (number + clue letter), a black
  square, or punctuation.
- Clues: label, clue text exactly as printed, and every blank number in order. Join blanks that wrap onto
  a following line.
- Look-alike characters (`O`/`0`/`Q`/`D`, `I`/`1`): use context. Grid numbers increase by one along the
  reading order, and clue labels are letters.
- Record any uncertainty in `notes` instead of guessing silently.

### 6.3 Repair pass (optional, if needed)

If validation finds a small number of problems, make **one** follow-up request with the same image plus the
specific issues ("square after 116 reads `117I`, but clue I doesn't list 117; re-read rows 8–9"). Merge the
corrections and re-validate. Cap it at one repair pass and leave the rest to the user. Only build this if the
eval shows it improves accuracy enough to justify the cost.

### 6.4 Validation (`validatePuzzle` in core)

The puzzle's own redundancy lets us check a parse without knowing the answer. Each check produces an
issue with a severity, a message, and a location (square and/or clue) so the review UI can highlight it.

| #   | Rule                                                                                              | Severity                         |
| --- | ------------------------------------------------------------------------------------------------- | -------------------------------- |
| V1  | Letter-square numbers are exactly 1..N, each appearing once                                       | error                            |
| V2  | Letter-square numbers increase by one in reading order                                            | warning (a likely misread digit) |
| V3  | The union of all clues' `cells` is exactly 1..N, with no number in two clues or twice in one clue | error                            |
| V4  | Each square's clue label equals the clue whose `cells` contain that number                        | error                            |
| V5  | Clue labels are the expected sequence (A, B, … / AA, BB, …), with none missing or duplicated      | error                            |
| V6  | Every row has `gridColumns` squares (the last row may be shorter)                                 | error                            |
| V7  | Every clue has at least one blank, and its text isn't empty                                       | error                            |
| V8  | Black squares don't appear twice in a row, and the grid doesn't start or end on one               | info                             |

V1, V3 and V4 together are very strong. A single misread digit almost always breaks two of them, which
also points to where the mistake is.

### 6.5 Cost and latency (estimates, to be measured)

- **Input:** the downscaled image is roughly 4.8k tokens, plus about 1–2k for the prompt (cached after the
  first call).
- **Output:** roughly 10–15k tokens of JSON for a 232-square puzzle, plus thinking.
- **Cost:** at Claude Opus 5.5 rates ($4 input / $20 output per million tokens), roughly **$0.25–$0.50
  per parse**.
- **Cloudflare plan:** the free plan allows only 10 ms of CPU time per request. Waiting on the Claude API
  doesn't count, but receiving the image and validating a large result may exceed it, so plan on Workers
  Paid ($5/month, 30 s CPU by default) when parsing ships. Measure first.
- **Latency:** likely 30–120 seconds. Workers allow long-running requests while the client stays connected,
  and waiting on the upstream fetch doesn't use CPU time. Stream progress to the browser.
- **Reducing cost (a goal, decided 2026-11-09).** These estimates are a starting point. Once the parser
  and its eval (§9.3) are running, we'll review the measured results together and pick options. Nothing
  is changed until we've seen the data. Options to measure, cheapest first:
  - **Lower effort** on the same model (`medium` or `low`). Often keeps quality on transcription tasks.
  - **Smaller image** (e.g. 2000 px long edge), which cuts image tokens. Risky for small digits.
  - **Cheaper model:** Claude Sonnet 5.5 ($2 / $10) or Claude Haiku 5.5 ($0.10 / $0.50).
  - **Compact output format:** e.g. grid rows as short strings like `"1O 2E 3P # 9C"` instead of one
    JSON object per square. Output tokens dominate the cost, so this may be the biggest single saving.
  - **Batch API** (50% off) doesn't fit, because the user is waiting for the result.
  - **Cascade:** parse with a cheap model, and re-parse with a stronger one only if validation fails.
    Measure the simpler options first.

### 6.6 Security and abuse

- **Uploads:** accept only `image/jpeg`, `image/png` and `image/webp`, at most 10 MB, and reject anything
  else before calling the API.
- **Sign-in required:** only signed-in users can call the parse endpoint or create rooms. That's the main
  protection for the API budget.
- **Rate limits:** per-user limits on parse requests (Workers rate-limiting binding), plus a global daily
  spend cap as a backstop.
- **Text in images is untrusted:** a hostile image could contain instructions. Structured output limits what
  can come back, and everything is validated as data. Nothing in the output is executed or treated as
  instructions.
- **Logging:** don't log image contents or full model output in production. Log only token usage, timing and
  validation results.

### 6.7 Alternatives considered

- **Traditional OCR** (Tesseract, cloud OCR): gives text but not structure. We'd still need custom layout
  logic to tell grid, clues and wrapped blanks apart, which is brittle across publishers.
- **Grid-detection CV plus OCR per cell:** high effort, and fragile with photos taken at an angle.
- **Claude vision with structured output (chosen):** handles layout and text in one step, works across
  publishers, and the validation layer covers its error modes.

### 6.8 Stretch goal: phone photos

Not built in v1, but nothing in the design should rule it out:

- **Input:** the upload accepts any image, and the browser can use `<input type="file" accept="image/*"
capture="environment">` to open the camera later, with no API change.
- **Expected extra work:** perspective and rotation correction, glare and shadow handling, and guidance for
  taking the photo (fill the frame, keep it flat). Possibly a client-side crop step before upload.
- **Measure first:** add phone photos to the parser eval set. Current Claude models may handle mild skew
  without any preprocessing, and the eval will show how much extra work is needed.

## 7. Real-time collaboration

Builds on the existing `PuzzleRoom` Durable Object and [ADR 0002](../adr/0002-collaboration-model.md)
(server-ordered, last write wins per cell).

### 7.1 Room lifecycle

- `POST /api/rooms { puzzle }`: validate, generate an unguessable room ID (about 128 bits, URL-safe), and
  store the puzzle in that room's Durable Object storage (SQLite). The link is the access control in v1.
- **Rooms last indefinitely** (decided). Durable Object storage has no automatic expiry, and a room is
  tiny (the puzzle plus a few hundred cells, a few KB), so storage cost per room is negligible. If cost
  ever becomes significant we'll revisit, e.g. archiving rooms untouched for a long time.
- **Anyone with the link can edit.** The unguessable room ID is the access control for solving.

### 7.2 Protocol additions (`packages/protocol`)

| Direction | Message                                        | Purpose                                                                |
| --------- | ---------------------------------------------- | ---------------------------------------------------------------------- |
| C→S       | `join { name, color? }`                        | Sent first after connecting                                            |
| S→C       | `snapshot { puzzle, cells, version, members }` | Full state on join or reconnect                                        |
| C→S       | `cell/set { cell, value, clientSeq }`          | Enter or clear a letter (already exists; add `clientSeq`)              |
| S→C       | `cell/updated { cell, value, version, by }`    | Broadcast to **all** clients, including the sender, as acknowledgement |
| C→S / S→C | `presence/update { cell \| null }`             | Selection highlighting for others                                      |
| S→C       | `member/joined`, `member/left`                 | Roster                                                                 |

- **Optimistic updates:** the client applies its own edit immediately. The echoed `cell/updated` confirms it
  or replaces it with the server's value.
- **Version numbers:** the per-room `version` lets a client detect a missed update and request a fresh
  snapshot.
- **Reconnects:** automatic, with backoff. Each reconnect gets a fresh snapshot, and edits made while
  disconnected are re-sent.

### 7.3 Storage in the room

- The puzzle definition is written once at room creation.
- A table holds one row per cell: `cell → letter, updatedBy, updatedAt`.
- The current version number is stored with the room.
- Updates are written in a single transaction before being broadcast.
- The creator's user ID is stored with the room (for a future "my puzzles" list).

### 7.4 Accounts and access

| Action                                         | Who can do it                                        |
| ---------------------------------------------- | ---------------------------------------------------- |
| Create a room for an imported or parsed puzzle | Signed-in users whose email is on the **allowlist**  |
| Create a room for the built-in **sample**      | Anyone, no sign-in (no parsing cost, tiny storage)   |
| Open a room link, join, and edit               | Anyone with the link, no sign-in (display name only) |
| See "My puzzles"                               | Signed-in users: the rooms they created              |

**Sign-in flow (decided 2026-11-09).** Google sign-in implemented in our own Worker, with no third-party
auth service:

1. **Sign in with Google** goes to `GET /api/auth/google`, which redirects to Google (OAuth 2.0
   authorization code flow with PKCE and a `state` check).
2. Google redirects back to `GET /api/auth/google/callback`. The Worker exchanges the code, verifies the
   ID token, and upserts the user.
3. The Worker creates a session and sets it as a cookie: `HttpOnly`, `Secure`, `SameSite=Lax`, holding
   only an opaque random token (the database stores a hash of it).
4. `getCurrentUser` (today's stand-in in `apps/worker/src/auth.ts`) resolves the user from that cookie.
   `GET /api/me` tells the web app who is signed in; `POST /api/auth/logout` ends the session.

**Storage: Cloudflare D1** (SQLite, included in the free plan), because accounts, sessions and "rooms I
created" are cross-room queries that per-room Durable Object storage can't answer.

| Table      | Columns                                                                           |
| ---------- | --------------------------------------------------------------------------------- |
| `users`    | id, google_sub (unique), email, name, picture_url, created_at, last_login_at      |
| `sessions` | token_hash, user_id, created_at, expires_at                                       |
| `rooms`    | room_id, created_by (user id, null for anonymous sample rooms), title, created_at |

**Details:**

- **User data:** Google account id, email, display name, and profile photo URL. Nothing else.
- **Allowlist:** a list of allowed emails, kept as a Cloudflare secret (`CREATOR_ALLOWLIST`) so the
  emails stay out of the public repo and can change without a code change. Anyone can sign in; only listed emails can create non-sample rooms.
  Signed-in users who aren't listed see a clear message.
- **Sessions:** 30 days, extended when used; sign-out deletes the session.
- **Secrets:** the Google client secret is a Cloudflare secret (`wrangler secret put`), and in
  `.dev.vars` (git-ignored) for local development. Never committed.
- **Rooms:** signed-in users' account name (and photo) are the default display name in rooms; they can
  still change the name.
- **Google setup (owner task):** a Google Cloud project with an OAuth client, consent screen details, and
  exact redirect URIs for local development and production.

## 8. User interface

- **Layout:** grid on top or left, clue list beside or below it. On narrow screens, use tabs or a sticky
  current-clue bar above the grid.
- **Grid square:** shows the number and clue label (small), plus the entered letter (large). Black squares
  are solid.
- **Highlights:** the selected square, the current word (the run between blocks), and the matching clue
  blank. Other users' selections appear in their colours.
- **Clue list:** clue text with a row of blanks under it. Blank numbers are shown, and filled letters
  mirror the grid.
- **Progress:** a "filled N / 232" counter, and the first letters of the answers shown as the acrostic
  forms.
- **Accessibility:** full keyboard play, ARIA grid semantics with labels like "Square 26, clue A, letter
  E", visible focus, sufficient contrast, and a layout that adapts to screen readers.
- **Mobile:** an on-screen keyboard strategy is needed, either a hidden input or a custom letter keyboard
  (open question).

## 9. Testing strategy

Follows the policy in CLAUDE.md. Additions specific to this design:

### 9.1 Golden fixture

Hand-transcribe the sample into `samples/puzzles/diplo-crostic-37.json` (the full grid and all 26
clues), along with the source image. This fixture is used for:

- Core unit tests: index building, validation passing on a real puzzle, and two-way entry on real data
- Validation tests: mutated copies (swap a digit, drop a blank, change a label) must produce the expected
  issues
- UI and integration tests with realistic sizes
- The parser eval

### 9.2 Automated tests (CI, no API calls)

- **Core:** `buildPuzzleIndex`, `validatePuzzle` (one test per rule), cursor and navigation functions, and
  normalization from `RawExtraction` to `Puzzle`.
- **Protocol:** schemas accept valid messages and reject malformed ones, for both the room protocol and
  `RawExtraction`.
- **Worker:** the parse endpoint with the Anthropic API **mocked** (recorded fixture responses, including
  invalid, `refusal` and `max_tokens` cases). Rooms: join → snapshot, broadcast with versions, reconnect,
  and persistence across Durable Object restarts.
- **Web:** two-way entry (type in a clue, then assert the grid square; and the reverse), keyboard
  navigation, review-screen issue highlighting, applying remote updates.
- **E2E:** two browser contexts in one room. One types in a clue, and the other sees the grid square update.

### 9.3 Parser eval (manual or scheduled, costs money)

A script runs the real parser on a set of images and scores the result against hand-made fixtures:
square-number accuracy, label accuracy, clue blank-list accuracy, and validation issues remaining. Start with
the sample, then add 5–10 more puzzles from different publishers (scans and screenshots first; phone
photos when we take on the stretch goal). Use it to choose
model, effort, image size and output format (§6.5), and to decide whether the repair pass is worth
building. Each run records token usage and cost per puzzle, so the options can be compared on both cost
and accuracy. Run it on demand, not on
every commit.

## 10. Proposed milestones

| #     | Milestone            | Outcome                                                                                                           |
| ----- | -------------------- | ----------------------------------------------------------------------------------------------------------------- |
| M1 ✅ | Domain core          | Puzzle model, index, two-way entry and cursor logic, `validatePuzzle`, golden fixture. All in core, fully tested. |
| M2 ✅ | Single-player solver | Grid and clue UI, keyboard play, JSON import / manual entry editor with validation.                               |
| M3 ✅ | Real-time rooms      | Room creation, persistence, snapshot and updates, presence, reconnects, shareable links.                          |
| M4 ✅ | Accounts             | Google sign-in (design discussion first), sessions, sign-in required to create rooms.                             |
| M5 ✅ | Image parsing        | Parse endpoint, Claude integration, review screen, parser eval, then a cost review together.                      |
| M6    | Polish               | Mobile input, accessibility pass, rate limits and spend cap, deploy.                                              |
| —     | Stretch              | Phone-photo capture (§6.8).                                                                                       |

Image parsing comes after the solver on purpose. The review screen _is_ the editor from M2, and the parser's output
needs a working solver to be useful. If you'd rather see image parsing working early, a quick prototype
of the Claude call against the sample image could run alongside M1.

## 11. Decisions and open questions

### Decided (2026-11-09)

| Topic           | Decision                                                                                                                                                                             |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Answer checking | None.                                                                                                                                                                                |
| Identity        | Google sign-in in our own Worker (§7.4). Creating rooms needs sign-in plus the email allowlist; sample rooms and joining by link need no sign-in. Store id, email, name, photo.      |
| Permissions     | Anyone with the room link can edit any square. No read-only viewers in v1.                                                                                                           |
| Retention       | Rooms last indefinitely. Revisit only if storage cost becomes significant.                                                                                                           |
| Phone photos    | Stretch goal. Keep it possible, build it later.                                                                                                                                      |
| Hosting         | Cloudflare Workers with static assets: one Worker serves the web app, API and rooms. Start on the free plan; expect to need Workers Paid ($5/month) once image parsing ships (§6.5). |
| My puzzles      | Signed-in users get a list of the rooms they created (M4).                                                                                                                           |
| Deploys         | Manual with `npm run deploy` (builds, migrates, deploys, smoke-tests). Automatic GitHub deploys maybe later. Live at https://acrosticle.tyrtel.workers.dev.                          |
| Parse cost      | Reduce where possible. Review the eval results and cost options together once parsing works.                                                                                         |

### Still open

1. **Production address:** the free `workers.dev` address or a custom domain (Google needs exact URLs).
2. **Spend cap:** the actual per-user limits and global daily budget for parsing.
3. **Undo:** personal undo of your own edits, or none?
4. **Mobile keyboard:** hidden input or a custom on-screen letter keyboard?
