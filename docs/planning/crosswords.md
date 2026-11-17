# Crosswords: plan

Status: **Phases 0–6 built (2026-11-17), not yet deployed.** Structure recorded in
[ADR 0006](../adr/0006-multiple-puzzle-types.md). Packages renamed to `@gridicles/*`. Still to come:
phase 7 (review screen + typing a crossword in) and phase 8 (reading crossword photos).

Goal: everything Acrosticle does for acrostics (real-time rooms, multi-letter entries, highlights,
undo/redo, phone typing, focus cues, My puzzles, sign-in, importing, image parsing, Copy to Sheet), for
crosswords.

## Recommendation in one paragraph

**Stay in this repository** and make the puzzle type a plug-in. Acrostics move into their own package
beside a new crossword package. Everything that doesn't care what kind of puzzle it is stays shared.
About 60% of the code already doesn't care. That includes nearly all the recent work (multi-letter
entries, highlights, undo, the Android typing fix, the focus highlighting), so crosswords get all of it
free, and future fixes land once for both. A second repository would start faster but would mean
porting every fix by hand forever. Whether crosswords ship as **a new worker (their own site)** or
**inside the existing one** is a separate decision that this layout supports either way (see
[Deployment](#deployment)).

## What the code run-through found

### Already puzzle-agnostic (reuse as is)

| Area                   | Files                                                                                             | Why it already fits                                                                                                     |
| ---------------------- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Solve state            | `core/solveState.ts`, `entries.ts`, `history.ts`, `marks.ts`                                      | A map of cell number → entry. Crosswords are the same shape                                                             |
| Wire protocol          | `protocol/messages.ts`, `versions.ts`                                                             | `cell/set`, `cell/mark`, presence and snapshots only talk about cell numbers. Only `snapshot.puzzle` is acrostic-shaped |
| Room server            | `worker/room/PuzzleRoom.ts`                                                                       | Stores cells, highlights and members. It touches the puzzle only to count cells and read the title                      |
| Client sync            | `web/features/room/` (`RoomConnection`, `roomState`, `useRoom`)                                   | Pending/confirmed edits and highlights, reconnects. Nothing acrostic-specific                                           |
| Accounts               | `worker/auth*.ts`, `db.ts`, `google.ts`, migrations; `web/features/account/`                      | Sign-in, sessions, My puzzles, creation dates                                                                           |
| Typing machinery       | `solver/composition.ts`, `textInput.ts`, `useMultiLetter.ts`, most of `keymap.ts`                 | Hidden input, Android composition, multi-letter mode (in crosswords this is a "rebus")                                  |
| Display pieces         | `components/EntryText`, `PeerTag`, `ThemeToggle`; `lib/clipboard.ts`, `dateTime.ts`, `theme.ts`   | Fitting long entries, cursor tags, themes, clipboard                                                                    |
| Image parsing plumbing | `worker/parsing.ts` (budget, rate limits, run log), `parser/parsePuzzleImage.ts` (calling Claude) | Only the prompt and output schema (`parser/prompt.ts`) are acrostic-specific                                            |

### Acrostic-specific (stays acrostic, gets a crossword sibling)

| Area                  | Files                                                              | Crossword difference                                                                                                         |
| --------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| Puzzle model + format | `core/puzzle.ts`, `compactGrid.ts`, `clueLabel.ts`, `editing.ts`   | Width × height grid, squares numbered by where words start, Across/Down clues, optional solution, circled and shaded squares |
| Validation            | `core/validatePuzzle.ts` (368 lines of acrostic rules)             | Different rules: numbering matches the grid, every word has a clue, answer lengths match                                     |
| Index + navigation    | `core/puzzleIndex.ts`, `navigation.ts`                             | Each square belongs to **two** words (across and down), not one clue. The cursor has a direction instead of a grid/clue view |
| Solver screen         | `solver/Solver.tsx`, `Grid.tsx`, `ClueList.tsx`, `AcrosticBar.tsx` | Grid with corner numbers, Across/Down lists, current-clue bar, click the same square to switch direction                     |
| Review/edit screen    | `features/editor/` (square/clue editors, issue list)               | A different review screen. Most crosswords arrive as .puz/.ipuz files, which are exact, so review matters less               |
| Copy to Sheet layout  | `sheetCopy/sheetLayout.ts` (the HTML/clipboard half is generic)    | Numbers grid + letters grid, clues in two lists                                                                              |
| Samples, prompt       | `samples/puzzles`, `parser/prompt.ts`                              | Public-domain crossword sample. A crossword reading prompt and evaluation set                                                |

### The key modeling choice

In acrostics, a square's printed number is its identity. Crosswords print numbers only where words
start, so many squares have none. **Give every crossword square an id from its position (row × width +
column + 1)** and keep the printed numbers as display data. Cell ids are still positive integers, so the
solve state, `cell/set`, highlights, undo, presence, the room's storage and the protocol's
version-adaptation all work for crosswords **without changes**.

## Target layout

```
packages/
  core/        shared, puzzle-agnostic: entries, solveState, history, marks, the PuzzleKind interface
  acrostic/    NEW: acrostic model, compact format, validation, index, navigation (moved out of core)
  crossword/   NEW: crossword model, numbering, .ipuz/.puz import, validation, index, navigation
  protocol/    messages (unchanged) + PuzzleFile becomes { kind: 'acrostic' | 'crossword', … }
  parser/      shared Claude plumbing; prompts per kind
apps/
  web/src/
    features/solving/    NEW: shared solver shell: hidden input, typing, multi-letter, undo, highlights, toolbar, focus
    features/acrostic/   acrostic grid, clue list, first-letters bar, review screen, sheet layout
    features/crossword/  NEW: crossword grid, Across/Down lists, clue bar, sheet layout
    features/room/       unchanged, except it picks the solver by puzzle kind
  worker/      unchanged, except puzzle checks go through the kind registry
```

Dependency direction stays one-way: `core` ← `acrostic`, `crossword` ← `protocol` ← `web`/`worker`.

### The `PuzzleKind` contract

Each puzzle type provides the same small set of pure functions, so the server and the shared UI never
branch on the type except at one registry:

```ts
interface PuzzleKind<P> {
  kind: 'acrostic' | 'crossword';
  parseFile(data: unknown): ParseResult<P>; // file → model
  validate(puzzle: P): ValidationIssue[]; // reuses the error / warning / info levels
  cellIds(puzzle: P): readonly CellNumber[]; // what the room accepts in cell/set and cell/mark
  title(puzzle: P): string | null;
}
```

The room checks a cell with `cellIds` instead of `cell <= cellCount`. Acrostic numbers run 1…N with no
gaps, so behavior is the same. Crossword ids skip black squares, so they need the real list.

### The shared solver shell

`Solver.tsx` is 518 lines, and about two-thirds of it is typing plumbing that crosswords need
unchanged:

- the hidden input and the sentinel character
- the `beforeinput`, `input` and `compositionend` handling for Android
- multi-letter mode, undo/redo and highlights
- the toolbar and focus state

That part moves into a `useSolverInput` hook plus the toolbar. Each puzzle type then supplies three
things:

- its own **navigation reducer** (a `reduceSolver` like today's, with its own selection type)
- its own grid and clue components
- a `describeSelection` that says which squares to tint and which clue is current

## Crossword design

### Model

- **Grid:** width and height. Each square is a block or an open square, with an optional solution
  (which can be several letters for a rebus), circled/shaded flags, and its printed number (derived from
  the grid when missing).
- **Clues:** `across` and `down` lists of `{ number, text, cells }`. The cells are derived from the
  grid; an imported file's own numbers are checked against them.
- **Metadata:** title, author, copyright, notes.
- **Puzzle file:** `.ipuz` (open JSON format) and `.puz` (the common binary format, well documented,
  including rebus squares and circles) are read in `packages/crossword` with **no new dependency**: the
  `.puz` reader is about 200 lines, tested against sample files. The stored file format is our own JSON,
  as for acrostics.

### Solving behavior: across mode and down mode (decided)

The grid is always in **across mode** or **down mode**, and it's always obvious which:

- the current word is tinted blue
- the selected square shows a small arrow (→ or ↓)
- the clue bar above the grid reads "14 Across: …"
- a toolbar button shows the mode and switches it (for touch screens)

The current square is yellow, with the same focus rules as now (yellow only while typing). The current
clue is tinted in its list, and the crossing clue gets a lighter tint.

- **Typing** (a letter, or a multi-letter entry when it's saved), into an empty square or over an
  existing entry: set the square, then move to the next **empty** square later in the word in the
  current direction, skipping filled ones. If no later square is empty, move to the word's **last
  square**. On the last square, the entry goes in and the cursor **stops**: it never jumps to the next
  clue.
- **Arrows:** an arrow along the current mode always moves **exactly one square** that way, filled or
  empty (black squares are stepped over, since the cursor can't sit on one). An arrow across the mode
  **switches the mode and doesn't move**. For example, ↓ or ↑ while typing across switches to down
  mode on the same square.
- **Space** switches the mode. Spaces inside multi-letter entries still work, since that box is a
  plain text field. **Enter** switches it too, like Enter's "switch" role in acrostics.
- **Clicking:** click a square to select it in the current mode. Click the selected square again to
  switch the mode. If the square has no word in the current direction (an unchecked square), the mode
  switches to the one it has. Clicking a clue selects its first empty square (its first square if
  full) in that clue's direction.
- **Backspace** clears the square. On an empty square it steps back one square in the word and clears
  that. **Delete** clears in place. **Tab / Shift+Tab** go to the next/previous clue's first empty
  square, running through Across and then Down.
- **Shared with acrostics, unchanged:**
  - multi-letter entries (rebus): Shift+Enter, Insert or the button
  - highlights: Ctrl+H, Ctrl/⌘+click or the button
  - undo/redo, phone typing, presence and the focus cues
- **Clue bar:** the current clue above the grid. It matters most on phones, where the lists sit below
  the grid.
- **Not now:** check and reveal (a future feature). Rooms are for creating and collaborating only.
  Solutions from imported files are **kept on the server and never sent to browsers**, so nobody can
  peek, and check/reveal can be added later without re-importing.

### Copy to Sheet

The clipboard converter (`sheetClipboard.ts`) is reused unchanged. A crossword layout gives:

- the numbers grid with the letters grid below it (both colored, including circles as a border or shade)
- Across and Down clue lists to the right, each with its answer pulled from the grid by formulas

That's the reverse of acrostics: here the grid holds the values, since crossword squares are shared by
two clues.

### Image parsing

Reading a crossword photo is harder than an acrostic: the model has to work out the grid shape and the
black squares from the picture, not just read printed labels. Plan it as its own step:

- a new prompt and schema
- the same budget and limits as now
- an evaluation set, like `parse-eval.md`

Validation (numbering must match the grid, answer lengths must match) catches most misreads. Files
(.puz/.ipuz) come first because they're exact and most crosswords are distributed that way. All three
sources are wanted (files, photos, typing one in), and reading photos will likely need the same rounds
of corrections the acrostic reader had.

### Typing a crossword in

A small grid builder for puzzles that exist only on paper:

- pick the size
- click squares to make them black (with mirror symmetry on by default)
- numbering and the clue slots fill in automatically
- type the clues

It reuses the review screen that photo parsing needs anyway, so a photo's draft and a hand-typed
puzzle are edited in the same place.

## Phases

Each phase ships on its own, keeps `npm run check` and the end-to-end tests green, and leaves acrostics
working unchanged for users.

| #   | Phase                                                                                                                                                                                               | Size   | User-visible?                 |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ----------------------------- |
| 0   | ADR 0006, addresses and names agreed, a public-domain crossword sample chosen                                                                                                                       | Small  | No                            |
| 1   | **Move acrostics out of core**: `packages/acrostic`, `PuzzleKind` registry, `kind` in the puzzle file (rooms stored before this read as acrostic), room checks through the registry, package rename | Medium | No (pure refactor)            |
| 2   | **Extract the solver shell**: `useSolverInput`, toolbar, focus; the acrostic solver rebuilt on top of it, with its tests unchanged as the safety net                                                | Medium | No (pure refactor)            |
| 3   | **Crossword core**: model, numbering, .ipuz and .puz import, validation, index, across/down navigation, with unit tests near 100% like core today                                                   | Large  | No                            |
| 4   | **Crossword site + solver**: the crossword worker and web app (sharing the database), grid, Across/Down lists, clue bar, mode indicator, protocol version 4, end-to-end test of two solvers         | Large  | **Yes**: solve imported files |
| 5   | **Creating crossword rooms**: import a file, a crossword sample, crossword rooms in My puzzles, shared sign-in across both sites                                                                    | Medium | Yes                           |
| 6   | **Copy to Sheet for crosswords**: numbers grid, letters grid, clues to the right with answers by formula                                                                                            | Small  | Yes                           |
| 7   | **Review screen + typing a crossword in** (grid builder)                                                                                                                                            | Medium | Yes                           |
| 8   | **Crossword image parsing** with an evaluation, on top of the review screen                                                                                                                         | Large  | Yes                           |
| —   | Later: check / reveal; anything that comes out of testing (timer, a "solved" moment, others' typing direction)                                                                                      |        |                               |

Phases 1–2 are the investment that makes the rest cheap. They change no behavior, and the existing 700+
tests protect them.

## Deployment (decided: two workers on tyrtel.workers.dev, shared accounts)

| Site       | Worker          | Address                                          |
| ---------- | --------------- | ------------------------------------------------ |
| Acrostics  | `acrosticle`    | `https://acrosticle.tyrtel.workers.dev` (as now) |
| Crosswords | `crosswordicle` | `https://crosswordicle.tyrtel.workers.dev`       |

- **Shared accounts:** both workers bind the same D1 database. That gives one set of users, sessions
  and rooms, and one My puzzles list showing rooms from both sites, each linking to its own site
  (rooms record their kind).
- **Shared sign-in:** the Public Suffix List lists `workers.dev` itself (checked 2026-11-17), so
  `tyrtel.workers.dev` counts as one site. The session cookie moves from host-only to
  `Domain=tyrtel.workers.dev`, so signing in on either site signs you in on both. That cookie also
  reaches any other worker on the account, which are all ours. Google sign-in keeps one callback;
  after signing in, it returns you to the site you started from (checked against the two known
  origins). Existing sessions would need one fresh sign-in after the switch.
- **Existing links:** nothing changes for Acrosticle. Room links and the address stay the same.
- **Later, if wanted:** a custom domain (e.g. `acrosticle.gridicles.com`) can be added in front of
  either worker without code changes beyond the cookie domain and allowed origins.
- **Deploys:** `npm run deploy` deploys and smoke-tests both workers (or one, by name).

## Decisions

Answered 2026-11-17:

1. **Separate sites, shared accounts:** two workers, `acrosticle.tyrtel.workers.dev` and
   `crosswordicle.tyrtel.workers.dev`, one database and one sign-in.
2. **All crossword sources:** .puz / .ipuz files, photos, and typing one in.
3. **No check / reveal for now**; creation and collaboration only. Solutions are stored but never sent.
4. **Navigation:** across/down modes as above. Arrows move exactly one square. Typing (also over an
   existing entry) moves to the next empty square in the word, else to its last square, and stops at
   the end of the word. Space (and Enter) switch the mode.
5. **Copy to Sheet:** numbers grid + letters grid, clues to the right with answers by formula.
6. **Nothing crossword-only up front**; revisit after testing.

## Builder / review (phase 7–8), decided 2026-11-17

Flow: **upload a photo, import a file, or start blank → the editor → Start solving.** Every crossword,
even a clean file, goes through the editor so the creator checks it first.

- **Editor, top: the grid.** Click a square to toggle black/white. Mirror symmetry is on by default
  and can be turned off. Resize rows and columns; start blank from a size picker. Numbers update
  automatically. Undo/redo. No circles, shading or answers in version 1.
- **Editor, below: one big clue text box** ("ACROSS / 1. Clue / … / DOWN / …"). Imports fill it in.
  Pasted text is read **locally** first (common layouts); a "Tidy with Claude" button sends messy
  text to Claude (cheap model, existing spending limits) and puts the cleaned clues back.
- **Checks never block** (stylized puzzles break the usual rules on purpose): missing or extra clues,
  unreadable clue lines, answer lengths like "(5)" that don't match, and grids without proper words
  are all warnings, and the data is kept. The only thing that stops Start solving is a grid with no
  open squares.
- **Photo parsing:** one photo with grid and clues (combine pages first if needed). Claude reads the
  size, black squares and clue text into the editor.
- **Creating any puzzle needs an allowlisted account** (acrostic or crossword), as now.
- Order: (A) editor + local clue reading ✅, (B) "Tidy with Claude" ✅ (2026-11-17: low effort on
  `PARSE_MODEL`, shares the hourly limit and daily budget with image reading), (C) photo parsing
  with an accuracy check.

## Still open

1. **Package name:** keep `@gridicles/*` (cheapest), or rename to a neutral umbrella name in phase 1
   (e.g. `@gridicles/*`), since the code now serves Crosswordicle too.
