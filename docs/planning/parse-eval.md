# Image parsing: cost review (2026-11-10)

Eval: `npm run eval:parse` on `samples/puzzles/diplo-crostic-37.jpg` (1853×2515 grayscale scan, 232
squares, 26 clues), scored against the as-printed transcription. Budget for the test pass: $4; spent
**$0.016**.

| Setting                  | Runs | Square numbers | Clue letters | Blanks | Clue text  | Issues flagged | Cost per image  | Time    |
| ------------------------ | ---- | -------------- | ------------ | ------ | ---------- | -------------- | --------------- | ------- |
| Haiku 5.5, effort low    | 3    | 100%           | 98.3%        | 100%   | 99.8–99.9% | 5              | $0.0035–$0.0046 | 21–30 s |
| Haiku 5.5, effort medium | 1    | 100%           | 99.1%        | 100%   | 99.8%      | 3              | $0.0036         | 22 s    |

"Issues flagged" includes the original's misprint (square 193), which a correct transcription reports.
Every other error was a wrong clue letter on a grid square, which validation flags with a one-click fix
derived from the clue blanks (always 100% correct).

**Decision:** production uses **Claude Haiku 5.5 at medium effort** (`PARSE_MODEL` / `PARSE_EFFORT` in
`apps/worker/wrangler.jsonc`). Sonnet and Opus weren't needed. Revisit with harder images (phone photos,
other publishers): raising the setting is a config change.
