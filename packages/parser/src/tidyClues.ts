import type { Crossword } from '@gridicles/crossword';
import { apiErrorMessage, usageOf } from './claude';
import type { ClaudeSender, Effort, Message, ParseFailure, StreamParams } from './parsePuzzleImage';
import { costUsd } from './pricing';

/** Longest clue text sent to Claude (a big crossword's clues are about 10,000 characters). */
export const MAX_CLUE_TEXT = 30_000;

export const TIDY_SYSTEM_PROMPT = `You turn messy crossword clue text into clean, numbered clues.

The text was pasted from somewhere (a PDF, a web page, a scan) and may have:
- Across and Down lists interleaved or side by side, or headings missing or misspelled
- clues broken across lines, or several clues run together on one line
- page furniture mixed in (page numbers, headers, ads, the puzzle title, answers to other puzzles)
- odd spacing, hyphenation from line breaks, or curly quotes

Rules:
- Keep each clue's wording exactly as written (fix only line-break hyphenation and spacing). Never
  invent, solve or reword clues. Keep answer lengths such as "(5)" or "(3,4)" at the end.
- Use the clue numbers printed in the text. Put each clue under Across or Down as printed; if the
  text has no headings, use other signs (an "A"/"D" after numbers, the order numbers restart).
- Leave out anything that isn't a clue.
- In "notes", briefly list anything you weren't sure about (a guessed direction, a number you
  couldn't read, text you left out that might be a clue). Empty if none.`;

export const TIDY_SCHEMA = {
  type: 'object',
  properties: {
    across: { type: 'array', items: { $ref: '#/$defs/clue' } },
    down: { type: 'array', items: { $ref: '#/$defs/clue' } },
    notes: { type: 'array', items: { type: 'string' } },
  },
  required: ['across', 'down', 'notes'],
  additionalProperties: false,
  $defs: {
    clue: {
      type: 'object',
      properties: { number: { type: 'integer' }, text: { type: 'string' } },
      required: ['number', 'text'],
      additionalProperties: false,
    },
  },
} as const;

export interface TidyOptions {
  readonly model: string;
  readonly effort?: Effort;
  readonly signal?: AbortSignal;
}

export type TidySuccess = {
  readonly ok: true;
  readonly clues: Crossword['clues'];
  readonly notes: readonly string[];
  readonly model: string;
  readonly usage: ReturnType<typeof usageOf>;
  readonly costUsd: number | null;
  readonly durationMs: number;
};

export type TidyOutcome = TidySuccess | ParseFailure;

/** Builds the request: plain text in, structured clues out. Clue text is small, so it's quick and cheap. */
export function buildTidyRequest(text: string, options: TidyOptions): StreamParams {
  return {
    model: options.model,
    max_tokens: 16_000,
    stream: true,
    system: [{ type: 'text', text: TIDY_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    output_config: {
      effort: options.effort ?? 'low',
      format: { type: 'json_schema', schema: TIDY_SCHEMA },
    },
    messages: [{ role: 'user', content: [{ type: 'text', text }] }],
  };
}

/**
 * Asks Claude to sort messy pasted clue text into Across and Down clues.
 * Never throws: every failure comes back as a value with a message.
 */
export async function tidyClues(
  send: ClaudeSender,
  text: string,
  options: TidyOptions,
): Promise<TidyOutcome> {
  const started = Date.now();
  let message: Message;
  try {
    message = await send(buildTidyRequest(text, options), options.signal);
  } catch (error) {
    return {
      ok: false,
      reason: 'api-error',
      message: apiErrorMessage(error, 'clues'),
    };
  }
  const usage = usageOf(message);
  const facts = {
    model: message.model,
    usage,
    costUsd: costUsd(message.model, usage),
    durationMs: Date.now() - started,
  };
  if (message.stop_reason === 'refusal') {
    return {
      ...facts,
      ok: false,
      reason: 'refusal',
      message: 'Claude declined to read this text.',
    };
  }
  if (message.stop_reason === 'max_tokens') {
    return {
      ...facts,
      ok: false,
      reason: 'truncated',
      message: 'That text was too long to tidy in one go.',
    };
  }
  const json = message.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('');
  const read = readTidy(json);
  if (!read) {
    return {
      ...facts,
      ok: false,
      reason: 'unreadable',
      message: "Couldn't find any clues in that text.",
    };
  }
  return { ...facts, ok: true, ...read };
}

function readTidy(json: string): { clues: Crossword['clues']; notes: string[] } | null {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return null;
  }
  if (typeof raw !== 'object' || raw === null) return null;
  const value = raw as Record<string, unknown>;
  const list = (key: string) =>
    (Array.isArray(value[key]) ? (value[key] as unknown[]) : []).flatMap((item) => {
      const clue = item as { number?: unknown; text?: unknown };
      return Number.isInteger(clue.number) &&
        (clue.number as number) > 0 &&
        typeof clue.text === 'string'
        ? [{ number: clue.number as number, text: clue.text.trim() }]
        : [];
    });
  const across = list('across');
  const down = list('down');
  if (across.length + down.length === 0) return null;
  const notes = Array.isArray(value.notes)
    ? value.notes.filter((n): n is string => typeof n === 'string' && n.trim() !== '')
    : [];
  return { clues: { across, down }, notes };
}
