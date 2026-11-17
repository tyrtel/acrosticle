# Features backlog

Requested features after the first deploy (2026-11-10), with recommendations and open questions.
Milestones M1–M4 are done and deployed; M5 (image parsing) and M6 (polish) are planned in
[design.md](design.md) §10.

| #   | Feature                                                     | Size   | Proposed slot        |
| --- | ----------------------------------------------------------- | ------ | -------------------- |
| F1  | Get back to the start screen to begin a new puzzle          | Small  | ✅ Done (2026-11-10) |
| F2  | "My puzzles" as a slide-in panel, with copy link and delete | Medium | ✅ Done (2026-11-10) |
| F3  | Any character in answer cells, not just A–Z                 | Medium | ✅ Done (2026-11-10) |
| F4  | Light / dark theme switch                                   | Small  | ✅ Done (2026-11-10) |
| F5  | Multi-character entries in a cell                           | Large  | ✅ Done (2026-11-13) |
| F6  | Typing on phones, and with dead keys / input methods        | Medium | ✅ Done (2026-11-10) |
| F7  | Undo and Redo (buttons, Ctrl/⌘+Z, Ctrl/⌘+Shift+Z, Ctrl+Y)   | Medium | ✅ Done (2026-11-10) |
| F8  | Highlight squares green, shared with the room               | Medium | ✅ Done (2026-11-17) |

## F1. Start a new puzzle from anywhere

Today the "Acrosticle" title links home, but nothing says so.

**Recommendation:** a **New puzzle** button in the header on every page, going to the start screen
(sample / import, and image upload once M5 lands). Also offer it at the top of the My puzzles panel.

## F2. My puzzles as a slide-in panel

**Recommendation:**

- A **My puzzles** button in the header opens a panel that slides in from the right over the current
  page (full width on phones). Escape, the close button, or clicking outside closes it; keyboard focus
  stays inside it while open.
- Each puzzle shows its title, when it was created, and actions: **Open**, **Copy link**, **Delete**.
- The panel keeps a shareable address (`?panel=my`), so old `/my` links still work.
- **Delete** asks for confirmation, then removes the room and its progress for everyone. Only the
  person who created it can delete it. Anyone still in the room sees "This puzzle was deleted" and
  their connection closes.

**Decided (2026-11-10):**

- Delete removes the puzzle **for everyone** (creator only, with confirmation).
- One list of every puzzle you **created or joined**, newest activity (last edit by anyone) first, with
  a small marker on the ones you created. Joining is recorded for signed-in users.

## F3. Any character in answer cells

Today a cell accepts one letter A–Z, and typing is uppercased.

**Recommendation:** accept any single printable character: letters, digits and symbols (no spaces or
control characters). The cursor keys (Enter, Tab, arrows, Backspace, Delete) keep their meanings.
This touches the domain type (`Letter` becomes a general "entry"), validation on both client and server,
the keymap, and how entries display.

**Decided (2026-11-10):** keep **exactly what's typed** (case preserved), and accept **any single
letter from any alphabet** (é, ñ, ß…), digits and symbols. No spaces or control characters.

## F4. Light / dark theme switch

The app already follows the device's light/dark setting.

**Recommendation:** a small theme button in the header that cycles **System → Light → Dark**, with an
icon showing the current choice. Remembered per device. Also review the dark palette (grid, highlights,
other solvers' colors) for contrast.

**Decided (2026-11-10):** per device (account sync can come later).

## F5. Multi-character entries

**Done (2026-11-12).** Decisions in [ADR 0005](../adr/0005-multi-character-entries.md).

**Decided:**

- **Solvers choose** when a square gets several characters, whether the puzzle calls for it or as a
  guess ("E or I"). Puzzles don't mark multi-character squares.
- **Up to 100 characters** per square (a server safety bound, not shown in the UI). Spaces are
  allowed between characters.
- The **acrostic bar shows only the first character** of each answer's first square.
- Start with **Shift+Enter** or **Insert**, or the **Multi-letter** button (for phones and mice).

### Typing: multi-letter mode

| Action                        | Effect                                                              |
| ----------------------------- | ------------------------------------------------------------------- |
| Shift+Enter, Insert or button | Opens an edit box on the selected square, holding its current entry |
| Type                          | Builds up the entry (arrows move within the text; paste works)      |
| Enter, Tab, Shift+Enter       | Saves; the cursor advances as after a normal letter                 |
| Insert                        | Also saves (it toggles the mode)                                    |
| Escape                        | Cancels; the square is unchanged                                    |
| Click or tap elsewhere        | Saves; moves if a square was clicked                                |
| Empty the box, then save      | Clears the square                                                   |

In this mode the solver's hidden input becomes a visible text box over the square, so caret
movement, paste, phone keyboards, autocorrect and IMEs all work natively. Outside the mode,
typing is unchanged (one character per square). Saving is one edit, so Undo restores the
previous entry in one step. Other solvers see the entry only once it's saved.

### Display: keeping long entries readable

| Entry length | Grid square                                                    |
| ------------ | -------------------------------------------------------------- |
| 1            | As today                                                       |
| 2–3          | Smaller text, one line                                         |
| 4–6          | Two lines, broken at a space when that fits ("E or" / "I")     |
| 7+           | The first five characters and "…" on two lines ("THR" / "EE…") |

The "…" marks an entry that's cut short (the square's corner already holds its number).

- The **selected square shows its full entry** in a callout above it; hovering shows it too.
- **Clue blanks** widen to fit short entries (up to about four characters' width), then truncate
  the same way.
- Screen-reader labels always include the full entry.

### Build order (each step tested; all four done 2026-11-12)

1. **Core:** widen `Entry` (1–100 graphemes, inner spaces) and add a `firstCharacter` helper for the
   acrostic. Review every `isEntry` / `normalizeEntry` caller so single-key typing stays single.
2. **Protocol + room:** `?v=2` on the WebSocket; v1 tabs get the reload message and first-character
   values. Worker integration tests for both versions.
3. **Display:** fitted text, truncation, callout and widened clue blanks (works before anyone can
   type a long entry, via fixtures).
4. **Multi-letter mode:** Shift+Enter / Insert / button, the visible edit box, save and cancel rules.
   Unit tests for the keymap, component tests for the mode, and an e2e check that two solvers see a
   saved multi-letter entry.

## F7. Undo and Redo

**Decided (2026-11-10):** per-person undo of **your own** edits, one step per edit, with a button and
keyboard shortcuts (Ctrl/⌘+Z; redo with Ctrl/⌘+Shift+Z or Ctrl+Y). If someone else has changed a square
since your edit, that undo step is **skipped**, so you never erase a collaborator's work. History is kept
for the current visit to a room (not across reloads). Redo is included.

## F8. Highlighted squares

**Done (2026-11-17):** anyone can highlight a square green as a solving aid; everyone in the room sees
it, and it's saved with the room. Ctrl+H toggles the selected square, Ctrl+click (⌘+click on a Mac)
toggles any square or blank without moving the cursor, and a Highlight button covers touch screens.
⌘H isn't used because it hides the app on a Mac. Highlights aren't part of Undo, don't change letters
or the acrostic, and don't bump the room version. A highlighted square that's also selected keeps a
green ring inside the yellow. Protocol version 3 (`cell/mark` → `cell/marked`, snapshot `marks`);
older tabs are told to reload and are sent no highlights.

## F6. Typing without key presses (was: M6, with the mobile keyboard)

**Done (2026-11-10):** typing now goes through one hidden text input placed on the selected square.
Tapping a square focuses it (phones open their keyboard), and text arrives as input events, covering
on-screen keyboards, swipe typing, dead keys and IMEs.

**Fixed (2026-11-12):** Samsung and other Android keyboards compose every word, even plain letters, and
may never end the composition, so letters never arrived. The solver now types composing text as it
changes (see `apps/web/src/features/solver/composition.ts`), which also shows IME text live.

Original notes:

Found while testing F3: the solver listens for key presses, so text that arrives without them is
skipped. That covers accents composed with dead keys (´ then e), input methods (IMEs) for languages
like Japanese or Chinese, and phone on-screen keyboards. Physical keys that produce a character
directly (including é on keyboards that have it) work. The fix is the planned mobile keyboard work: a
hidden input that receives text input events.

## Image parsing (M5)

Built 2026-11-10 (see design.md §6 and ADR 0004). **Cost review done** (2026-11-10, $0.016 of the $4
test budget): Claude Haiku 5.5 at medium effort, about $0.004 per image, 99%+ accurate on the sample with
every remaining error flagged and fixable in one click. Details in [parse-eval.md](parse-eval.md).

## Also queued

- ✅ **Tell same-titled puzzles apart** in My puzzles (done 2026-11-12): each puzzle shows when it was
  created ("Created Nov 10, 3:42 PM · Active 5 minutes ago"); the year appears for older ones.

- **Rate limiting** anonymous sample-room creation (still queued: M5 added limits for image parsing only).
- **Automatic deploys from GitHub**: maybe later. Deploys stay manual (`npm run deploy`) for now.
