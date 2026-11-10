import { puzzleFromCompact, validatePuzzle, type ValidationIssue } from '@acrosticle/core';
import { PuzzleFile, validateWith } from '@acrosticle/protocol';
import type Anthropic from '@anthropic-ai/sdk';
import { costUsd, type TokenUsage } from './pricing';
import { EXTRACTION_SCHEMA, SYSTEM_PROMPT } from './prompt';

type StreamParams = Anthropic.Beta.Messages.MessageCreateParamsStreaming;
type Message = Anthropic.Beta.Messages.BetaMessage;

/**
 * Sends one request to Claude and resolves with the final message. Injected so
 * tests can fake it; use `anthropicSender` in real code.
 */
export type ClaudeSender = (params: StreamParams, signal?: AbortSignal) => Promise<Message>;

/** The real sender: streams (long outputs would hit HTTP timeouts otherwise) and returns the final message. */
export function anthropicSender(client: Anthropic): ClaudeSender {
  return (params, signal) =>
    client.beta.messages.stream(params, signal ? { signal } : undefined).finalMessage();
}

export const IMAGE_MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;
export type ImageMediaType = (typeof IMAGE_MEDIA_TYPES)[number];

export interface PuzzleImage {
  /** Base64-encoded image bytes (no data: prefix). */
  readonly data: string;
  readonly mediaType: ImageMediaType;
}

export type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';

export interface ParseOptions {
  readonly model?: string;
  readonly effort?: Effort;
  readonly maxTokens?: number;
  readonly signal?: AbortSignal;
}

export const DEFAULT_MODEL = 'claude-opus-5-5';
export const MODELS = ['claude-haiku-5-5', 'claude-sonnet-5-5', 'claude-opus-5-5'] as const;
export const EFFORTS: readonly Effort[] = ['low', 'medium', 'high', 'xhigh', 'max'];

/**
 * Models that accept the server-side `fallbacks: "default"` form (per the
 * Claude API reference: Opus 5.5, Fable 5.1, Opus 5, and Sonnet 5.5 on the
 * Claude API). Others (e.g. Haiku 5.5) would reject it, so it isn't sent.
 */
const DEFAULT_FALLBACK_MODELS = new Set([
  'claude-opus-5-5',
  'claude-fable-5-1',
  'claude-opus-5',
  'claude-sonnet-5-5',
]);

export function supportsDefaultFallback(model: string): boolean {
  return DEFAULT_FALLBACK_MODELS.has(model);
}

export function isEffort(value: string): value is Effort {
  return (EFFORTS as readonly string[]).includes(value);
}
export const DEFAULT_EFFORT: Effort = 'high';
export const DEFAULT_MAX_TOKENS = 64_000;

interface RunFacts {
  readonly model: string;
  readonly usage: TokenUsage;
  readonly costUsd: number | null;
  readonly durationMs: number;
}

export type ParseSuccess = RunFacts & {
  readonly ok: true;
  /** The draft puzzle, as printed (it may still have issues to fix in review). */
  readonly file: PuzzleFile;
  readonly notes: readonly string[];
  readonly issues: readonly ValidationIssue[];
};

export type ParseFailureReason =
  | 'refusal' // Claude declined (safety classifiers)
  | 'truncated' // hit max_tokens before finishing
  | 'unreadable' // output didn't form a usable puzzle
  | 'api-error'; // network, rate limit, overload, bad key, ...

export type ParseFailure = Partial<RunFacts> & {
  readonly ok: false;
  readonly reason: ParseFailureReason;
  /** For people: what went wrong and what to try. */
  readonly message: string;
};

export type ParseOutcome = ParseSuccess | ParseFailure;

/** Builds the Messages API request for one image. */
export function buildRequest(image: PuzzleImage, options: ParseOptions = {}): StreamParams {
  const model = options.model ?? DEFAULT_MODEL;
  return {
    model,
    max_tokens: options.maxTokens ?? DEFAULT_MAX_TOKENS,
    stream: true,
    // If a safety classifier declines, retry on a fallback model chosen by refusal
    // category, where the model supports it. Thinking is left at each model's
    // adaptive default; effort is always set explicitly (defaults differ by model).
    ...(supportsDefaultFallback(model) && {
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default' as const,
    }),
    system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    output_config: {
      effort: options.effort ?? DEFAULT_EFFORT,
      format: { type: 'json_schema', schema: EXTRACTION_SCHEMA },
    },
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: image.mediaType, data: image.data },
          },
          { type: 'text', text: 'Transcribe this acrostic puzzle.' },
        ],
      },
    ],
  };
}

/**
 * Reads a photo or scan of an acrostic into a draft puzzle file using Claude's
 * vision. Never throws: every failure comes back as a value with a message.
 */
export async function parsePuzzleImage(
  send: ClaudeSender,
  image: PuzzleImage,
  options: ParseOptions = {},
): Promise<ParseOutcome> {
  const request = buildRequest(image, options);
  const started = Date.now();

  let message: Message;
  try {
    message = await send(request, options.signal);
  } catch (error) {
    return { ok: false, reason: 'api-error', message: apiErrorMessage(error) };
  }

  const usage = usageOf(message);
  const facts: RunFacts = {
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

  const text = message.content
    .flatMap((block) => (block.type === 'text' ? [block.text] : []))
    .join('');
  const extracted = readExtraction(text);
  if (!extracted.ok)
    return { ...facts, ok: false, reason: 'unreadable', message: extracted.message };

  return { ...facts, ...extracted };
}

function readExtraction(
  text: string,
):
  | { ok: true; file: PuzzleFile; notes: string[]; issues: ValidationIssue[] }
  | { ok: false; message: string } {
  const unreadable = {
    ok: false as const,
    message: "Couldn't make out a puzzle in this image. Check it shows the whole grid and clues.",
  };

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return unreadable;
  }
  if (typeof raw !== 'object' || raw === null) return unreadable;
  const value = raw as Record<string, unknown>;
  const optional = (key: string) =>
    typeof value[key] === 'string' && value[key] !== '' ? { [key]: value[key] } : {};

  const file = validateWith(PuzzleFile, {
    ...optional('title'),
    ...optional('constructedBy'),
    grid: { columns: value.columns, rows: value.rows },
    clues: value.clues,
  });
  if (!file.ok) return unreadable;
  const converted = puzzleFromCompact(file.value);
  if (!converted.ok) return unreadable;

  const notes = Array.isArray(value.notes)
    ? value.notes.filter((note): note is string => typeof note === 'string' && note.trim() !== '')
    : [];
  return { ok: true, file: file.value, notes, issues: validatePuzzle(converted.puzzle) };
}

function usageOf(message: Message): TokenUsage {
  return {
    inputTokens: message.usage.input_tokens,
    outputTokens: message.usage.output_tokens,
    cacheWriteTokens: message.usage.cache_creation_input_tokens ?? 0,
    cacheReadTokens: message.usage.cache_read_input_tokens ?? 0,
  };
}

function apiErrorMessage(error: unknown): string {
  const status =
    typeof error === 'object' && error !== null && 'status' in error
      ? (error as { status?: unknown }).status
      : undefined;
  if (error instanceof Error && error.name === 'AbortError')
    return 'Reading the puzzle was cancelled.';
  if (status === 401 || status === 403)
    return "Image parsing isn't set up correctly on this server.";
  if (status === 429) return 'Image parsing is busy right now. Please try again in a minute.';
  if (status === 529 || (typeof status === 'number' && status >= 500)) {
    return 'The image service is temporarily unavailable. Please try again soon.';
  }
  if (status === 400 || status === 413)
    return "This image couldn't be processed. Try a smaller or clearer image.";
  return "Couldn't reach the image service. Please try again.";
}
