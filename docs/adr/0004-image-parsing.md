# ADR 0004: Reading puzzle images with Claude

- **Status:** Accepted (built in M5, 2026-11-10; model and effort to be chosen after the cost review)
- **Date:** 2026-11-10

## Context

People want to start a puzzle from a photo or scan of a printed acrostic. The reader has to recover
the grid's structure (numbered squares with clue labels, black squares), every clue's text, and each
clue's ordered list of answer blanks, which often wrap onto a second line. Mistakes must not slip into
a room unnoticed.

## Decision

- **Claude vision with structured output.** One Messages API request per image, from the Worker
  (`packages/parser`, shared with the eval script). The model is asked to transcribe exactly as
  printed, never solve or "fix" misprints.
- **Compact output.** The response uses the puzzle-file shape: grid rows as short strings
  (`"1O 2E # 3P"`) rather than one JSON object per square. Output tokens are most of the cost, and this
  keeps them low. A JSON schema (`output_config.format`) fixes the shape; plus `notes` for anything
  Claude was unsure of.
- **Validation, then human review.** The draft goes through `validatePuzzle`, whose cross-checks catch
  misreads and genuine misprints, and then the existing review screen, where the creator fixes issues
  before a room is created. Nothing is trusted just because Claude produced it.
- **Configurable model and effort.** `PARSE_MODEL` and `PARSE_EFFORT` are Worker settings, so the
  cost review can change them without a code change. Defaults: Claude Opus 5.5, `high` effort.
  Thinking is left at each model's adaptive default.
- **Refusal fallbacks where supported.** `fallbacks: "default"` (with its beta header) is sent only to
  models that accept it (Opus 5.5, Fable 5.1, Opus 5, Sonnet 5.5 on the Claude API), not to Haiku 5.5.
- **Streaming** for the long response (`messages.stream().finalMessage()`), with `stop_reason` checked
  for `refusal` and `max_tokens` before any output is used.
- **Spending protection.** Only allowlisted creators can parse; each person can parse 10 images an
  hour; a daily budget across everyone (`PARSE_DAILY_BUDGET_USD`, default $5) is checked before calling
  Claude. Every parse is recorded in D1 (`parse_runs`) with its tokens and cost.
- **Measured choices.** `npm run eval:parse` scores accuracy and cost on the sample against its
  hand-made transcription, starting with the cheapest model, with a cumulative spend ledger and budget.

## Alternatives considered

- **OCR (Tesseract, cloud OCR):** gives text without structure; separating grid, clues and wrapped
  blanks would need brittle custom layout code for each publisher's style.
- **Grid detection plus per-cell OCR:** a lot of computer-vision work, and fragile with photos.
- **One JSON object per square:** easier to read, but several times the output tokens.

## Consequences

- Each parse costs money, so limits, the budget and the run log matter, and the model choice should
  follow the eval results.
- Phone photos (skew, glare) aren't specially handled yet; the eval will show how far Claude gets
  unaided (design §6.8).
- The Workers free plan's 10 ms CPU limit may be tight for large uploads; to be measured in
  production (design §6.5).
