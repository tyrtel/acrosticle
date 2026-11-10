# Features backlog

Requested features after the first deploy (2026-11-10), with recommendations and open questions.
Milestones M1–M4 are done and deployed; M5 (image parsing) and M6 (polish) are planned in
[design.md](design.md) §10.

| #   | Feature                                                     | Size   | Proposed slot                          |
| --- | ----------------------------------------------------------- | ------ | -------------------------------------- |
| F1  | Get back to the start screen to begin a new puzzle          | Small  | ✅ Done (2026-11-10)                   |
| F2  | "My puzzles" as a slide-in panel, with copy link and delete | Medium | ✅ Done (2026-11-10)                   |
| F3  | Any character in answer cells, not just A–Z                 | Medium | ✅ Done (2026-11-10)                   |
| F4  | Light / dark theme switch                                   | Small  | ✅ Done (2026-11-10)                   |
| F5  | Multi-character entries in a cell                           | Large  | M6 (polish), after a design discussion |
| F6  | Typing on phones, and with dead keys / input methods        | Medium | ✅ Done (2026-11-10)                   |
| F7  | Undo and Redo (buttons, Ctrl/⌘+Z, Ctrl/⌘+Shift+Z, Ctrl+Y)   | Medium | ✅ Done (2026-11-10)                   |

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

## F5. Multi-character entries (polish)

Some puzzles put several letters in one square. This affects typing, how the cursor moves, display
size, the acrostic letters, validation, and the room protocol. To be designed later, with options and
trade-offs, as part of M6.

## F7. Undo and Redo

**Decided (2026-11-10):** per-person undo of **your own** edits, one step per edit, with a button and
keyboard shortcuts (Ctrl/⌘+Z; redo with Ctrl/⌘+Shift+Z or Ctrl+Y). If someone else has changed a square
since your edit, that undo step is **skipped**, so you never erase a collaborator's work. History is kept
for the current visit to a room (not across reloads). Redo is included.

## F6. Typing without key presses (was: M6, with the mobile keyboard)

**Done (2026-11-10):** typing now goes through one hidden text input placed on the selected square.
Tapping a square focuses it (phones open their keyboard), and text arrives as input events, covering
on-screen keyboards, swipe typing, dead keys and IMEs. Original notes:

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

- **Tell same-titled puzzles apart** in My puzzles (e.g. show when each was created, or a short id):
  rooms made from the same puzzle currently look identical in the list.

- **Rate limiting** anonymous sample-room creation (still queued: M5 added limits for image parsing only).
- **Automatic deploys from GitHub**: maybe later. Deploys stay manual (`npm run deploy`) for now.
