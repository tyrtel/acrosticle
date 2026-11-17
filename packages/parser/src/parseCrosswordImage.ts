import {
  crosswordFromFile,
  crosswordToFile,
  MAX_CROSSWORD_SIZE,
  reconcileWithClues,
  type CrosswordFileData,
  type PrintedNumber,
} from '@gridicles/crossword';
import { apiErrorMessage, usageOf } from './claude';
import { CROSSWORD_SCHEMA, CROSSWORD_SYSTEM_PROMPT } from './crosswordPrompt';
import {
  DEFAULT_EFFORT,
  DEFAULT_MAX_TOKENS,
  DEFAULT_MODEL,
  supportsDefaultFallback,
  type ClaudeSender,
  type Message,
  type ParseFailure,
  type ParseOptions,
  type PuzzleImage,
  type StreamParams,
} from './parsePuzzleImage';
import { costUsd, type TokenUsage } from './pricing';

export type CrosswordParseSuccess = {
  readonly ok: true;
  /** The draft, as read: the creator checks and fixes it in the editor. */
  readonly file: CrosswordFileData & { readonly kind: 'crossword' };
  readonly notes: readonly string[];
  readonly model: string;
  readonly usage: TokenUsage;
  readonly costUsd: number | null;
  readonly durationMs: number;
};

export type CrosswordParseOutcome = CrosswordParseSuccess | ParseFailure;

/** Builds the Messages API request for one crossword image. */
export function buildCrosswordRequest(
  image: PuzzleImage,
  options: ParseOptions = {},
): StreamParams {
  const model = options.model ?? DEFAULT_MODEL;
  return {
    model,
    max_tokens: options.maxTokens ?? DEFAULT_MAX_TOKENS,
    stream: true,
    ...(supportsDefaultFallback(model) && {
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default' as const,
    }),
    system: [{ type: 'text', text: CROSSWORD_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    output_config: {
      effort: options.effort ?? DEFAULT_EFFORT,
      format: { type: 'json_schema', schema: CROSSWORD_SCHEMA },
    },
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: image.mediaType, data: image.data },
          },
          { type: 'text', text: 'Transcribe this crossword.' },
        ],
      },
    ],
  };
}

/**
 * Reads a photo of a crossword (standard, barred, or rows-and-columns; grid
 * and clues, or just the grid) into a draft for the editor. Never throws.
 */
export async function parseCrosswordImage(
  send: ClaudeSender,
  image: PuzzleImage,
  options: ParseOptions = {},
): Promise<CrosswordParseOutcome> {
  const started = Date.now();
  let message: Message;
  try {
    message = await send(buildCrosswordRequest(image, options), options.signal);
  } catch (error) {
    return { ok: false, reason: 'api-error', message: apiErrorMessage(error) };
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
      message: 'Claude declined to read this image. Try a clearer photo of just the puzzle.',
    };
  }
  if (message.stop_reason === 'max_tokens') {
    return {
      ...facts,
      ok: false,
      reason: 'truncated',
      message: 'The puzzle was too large to read in one go. Try a tighter crop of the puzzle.',
    };
  }
  const json = message.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('');
  const read = readCrosswordExtraction(json);
  if (!read) {
    return {
      ...facts,
      ok: false,
      reason: 'unreadable',
      message: "Couldn't make out a crossword in this image. Check it shows the whole grid.",
    };
  }
  return { ...facts, ok: true, ...read };
}

/**
 * Turns Claude's answer into a crossword file, keeping as much as possible:
 * rows are evened out to the grid's width, and bars or clues that don't fit
 * are dropped with a note instead of failing the whole read.
 */
export function readCrosswordExtraction(
  json: string,
): { file: CrosswordParseSuccess['file']; notes: string[] } | null {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return null;
  }
  if (typeof raw !== 'object' || raw === null) return null;
  const value = raw as Record<string, unknown>;
  const notes = strings(value.notes);

  const rowsIn = strings(value.rows);
  const height = clamp(Number(value.height) || rowsIn.length);
  const width = clamp(
    Number(value.width) || Math.max(0, ...rowsIn.map((row) => Array.from(row).length)),
  );
  if (width === 0 || height === 0) return null;
  const rows = Array.from({ length: height }, (_, r) => {
    const squares = Array.from(rowsIn[r] ?? '').map((ch) => (ch === '#' ? '#' : '.'));
    return [...squares, ...Array<string>(width).fill('.')].slice(0, width).join('');
  });
  if (rowsIn.length !== height || rowsIn.some((row) => Array.from(row).length !== width)) {
    notes.push(`The grid's rows didn't all come out ${width} squares wide; check the grid.`);
  }

  const right: number[] = [];
  const bottom: number[] = [];
  for (const bar of Array.isArray(value.bars) ? (value.bars as unknown[]) : []) {
    const { row, column, side } = (bar ?? {}) as {
      row?: unknown;
      column?: unknown;
      side?: unknown;
    };
    if (
      typeof row !== 'number' ||
      typeof column !== 'number' ||
      row < 1 ||
      row > height ||
      column < 1 ||
      column > width
    ) {
      continue;
    }
    const cell = (row - 1) * width + column;
    if (side === 'right' && column < width) right.push(cell);
    if (side === 'bottom' && row < height) bottom.push(cell);
  }

  const clues = (key: string) =>
    (Array.isArray(value[key]) ? (value[key] as unknown[]) : []).flatMap((item) => {
      const clue = (item ?? {}) as { number?: unknown; text?: unknown };
      return Number.isInteger(clue.number) &&
        (clue.number as number) > 0 &&
        typeof clue.text === 'string'
        ? [{ number: clue.number as number, text: clue.text.trim() }]
        : [];
    });
  const text = (key: string) => (typeof value[key] === 'string' ? value[key].trim() : '');

  const file: CrosswordParseSuccess['file'] = {
    kind: 'crossword',
    ...(text('title') && { title: text('title') }),
    ...(text('author') && { author: text('author') }),
    ...(text('instructions') && { notes: text('instructions') }),
    ...(value.style === 'rows-columns' && { style: 'rows-columns' as const }),
    grid: rows,
    ...(right.length + bottom.length > 0 && {
      bars: {
        right: [...new Set(right)].sort((a, b) => a - b),
        bottom: [...new Set(bottom)].sort((a, b) => a - b),
      },
    }),
    clues: { across: clues('across'), down: clues('down') },
  };
  return repairWithClues(file, printedNumbers(value.numbers, width, height), notes);
}

/** Fixes the grid from the clue numbers and lengths where it can (see reconcileWithClues). */
function repairWithClues(
  file: CrosswordParseSuccess['file'],
  printed: readonly PrintedNumber[],
  notes: string[],
): { file: CrosswordParseSuccess['file']; notes: string[] } {
  const read = crosswordFromFile(file);
  if (!read.ok) return { file, notes };
  const repaired = reconcileWithClues(read.crossword, printed);
  if (repaired.notes.length === 0) return { file, notes };
  return {
    file: { kind: 'crossword', ...crosswordToFile(repaired.crossword) },
    notes: [...notes, ...repaired.notes],
  };
}

function printedNumbers(value: unknown, width: number, height: number): PrintedNumber[] {
  return (Array.isArray(value) ? (value as unknown[]) : []).flatMap((item) => {
    const { number, row, column } = (item ?? {}) as Record<string, unknown>;
    return Number.isInteger(number) &&
      Number.isInteger(row) &&
      Number.isInteger(column) &&
      (row as number) >= 1 &&
      (row as number) <= height &&
      (column as number) >= 1 &&
      (column as number) <= width
      ? [{ number: number as number, row: row as number, column: column as number }]
      : [];
  });
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim() !== '')
    : [];
}

function clamp(size: number): number {
  return Number.isFinite(size) ? Math.min(MAX_CROSSWORD_SIZE, Math.max(0, Math.round(size))) : 0;
}
