import { hasErrors } from '@gridicles/acrostic';
import { clueNumberFit, crosswordFromFile, type CrosswordFileData } from '@gridicles/crossword';
import {
  anthropicSender,
  DEFAULT_EFFORT,
  DEFAULT_MODEL,
  IMAGE_MEDIA_TYPES,
  isEffort,
  parseCrosswordImage,
  parsePuzzleImage,
  tidyClues,
  type CrosswordParseOutcome,
  type TokenUsage,
  type Effort,
  type ClaudeSender,
  type ImageMediaType,
} from '@gridicles/parser';
import {
  TidyCluesRequest,
  validateWith,
  type ApiError,
  type ParseCrosswordResponse,
  type ParsePuzzleResponse,
  type TidyCluesResponse,
} from '@gridicles/protocol';
import Anthropic from '@anthropic-ai/sdk';
import { Buffer } from 'node:buffer';
import { canCreate, getCurrentUser } from './auth';
import { countParsesSince, parseSpendSince, recordParseRun } from './db';

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const PARSES_PER_HOUR = 10;
const HOUR_MS = 60 * 60 * 1000;

/**
 * The Anthropic API key, if this server has one. It's an optional secret (not
 * in wrangler's secrets.required), so it's read here rather than typed on Env.
 */
export function anthropicApiKey(env: Env): string | undefined {
  const key = (env as Env & { ANTHROPIC_API_KEY?: unknown }).ANTHROPIC_API_KEY;
  return typeof key === 'string' && key !== '' ? key : undefined;
}

/**
 * `POST /api/puzzles/parse`: reads an uploaded image of an acrostic into a
 * draft puzzle file with Claude. Allowlisted creators only, with per-user and
 * daily spending limits checked before calling Claude.
 *
 * CPU note: the Workers free plan allows 10 ms of CPU per request. Waiting on
 * Claude doesn't count, and base64 encoding uses native Buffer, but large
 * uploads may still need Workers Paid; measure in production (design §6.5).
 */
export async function parsePuzzle(
  request: Request,
  env: Env,
  sender?: ClaudeSender,
  now = Date.now(),
): Promise<Response> {
  return readImage(request, env, sender, now, {
    read: (send, image) => parsePuzzleImage(send, image, parseSettings(env)),
    respond: (outcome) => {
      const body: ParsePuzzleResponse = {
        file: outcome.file,
        notes: [...outcome.notes],
        issues: outcome.issues.map(({ code, severity, message }) => ({ code, severity, message })),
        needsFixes: hasErrors(outcome.issues),
        costUsd: outcome.costUsd,
      };
      return body;
    },
  });
}

/**
 * `POST /api/crosswords/parse`: reads an uploaded crossword image (standard,
 * barred or rows-and-columns; grid and clues, or just the grid) into a draft
 * for the editor. Same rules and limits as reading acrostics.
 */
export async function parseCrossword(
  request: Request,
  env: Env,
  sender?: ClaudeSender,
  now = Date.now(),
): Promise<Response> {
  return readImage(request, env, sender, now, {
    read: (send, image) => readCrosswordTwiceIfNeeded(env, now, send, image),
    respond: (outcome) => {
      const body: ParseCrosswordResponse = {
        file: outcome.file,
        notes: [...outcome.notes],
        costUsd: outcome.costUsd,
      };
      return body;
    },
  });
}

/**
 * Reads a crossword with the configured model, and if the grid it read
 * doesn't number itself the way the printed clues do (barred grids, faint
 * lines), takes a second look with the stronger model (PARSE_STRONG_MODEL),
 * keeping whichever read fits the clues better. The second look is skipped
 * once today's budget is used up. Both reads count as one logged run.
 */
async function readCrosswordTwiceIfNeeded(
  env: Env,
  now: number,
  send: ClaudeSender,
  image: { data: string; mediaType: ImageMediaType },
): Promise<CrosswordParseOutcome> {
  const first = await parseCrosswordImage(send, image, parseSettings(env));
  if (!first.ok) return first;
  const firstFit = fitOf(first.file);
  if (firstFit === null || firstFit >= 1) return first;
  const budget = Number(env.PARSE_DAILY_BUDGET_USD) || 0;
  if ((await parseSpendSince(env.DB, startOfUtcDay(now))) + (first.costUsd ?? 0) >= budget) {
    return first;
  }

  const second = await parseCrosswordImage(send, image, {
    model: env.PARSE_STRONG_MODEL || STRONG_MODEL,
    effort: 'high',
  });
  const both = {
    costUsd: (first.costUsd ?? 0) + (second.costUsd ?? 0),
    durationMs: first.durationMs + (second.durationMs ?? 0),
    usage: {
      inputTokens: first.usage.inputTokens + (second.usage?.inputTokens ?? 0),
      outputTokens: first.usage.outputTokens + (second.usage?.outputTokens ?? 0),
      cacheWriteTokens: first.usage.cacheWriteTokens + (second.usage?.cacheWriteTokens ?? 0),
      cacheReadTokens: first.usage.cacheReadTokens + (second.usage?.cacheReadTokens ?? 0),
    },
  };
  if (!second.ok || (fitOf(second.file) ?? 0) <= firstFit) return { ...first, ...both };
  return {
    ...second,
    ...both,
    notes: [
      ...second.notes,
      'The first reading of the grid didn’t match the clue numbers, so it was read again more carefully.',
    ],
  };
}

/** The stronger model for second looks, unless PARSE_STRONG_MODEL says otherwise. */
const STRONG_MODEL = 'claude-opus-5-5';

/** How well a read grid's numbering matches its clues (null if there's nothing to check). */
function fitOf(file: CrosswordFileData): number | null {
  const read = crosswordFromFile(file);
  return read.ok ? clueNumberFit(read.crossword) : 0;
}

/** What a run tells the log, for any Claude feature. */
interface RunFacts {
  readonly ok: boolean;
  readonly reason?: string;
  readonly message?: string;
  readonly model?: string;
  readonly usage?: TokenUsage;
  readonly costUsd?: number | null;
  readonly durationMs?: number;
}

/**
 * The steps every image upload shares: allowlisted creators only, a valid
 * image, the per-person and daily limits checked before calling Claude, and
 * every run logged for cost review.
 *
 * CPU note: the Workers free plan allows 10 ms of CPU per request. Waiting on
 * Claude doesn't count, and base64 encoding uses native Buffer, but large
 * uploads may still need Workers Paid; measure in production (design §6.5).
 */
async function readImage<T extends RunFacts>(
  request: Request,
  env: Env,
  sender: ClaudeSender | undefined,
  now: number,
  steps: {
    read: (send: ClaudeSender, image: { data: string; mediaType: ImageMediaType }) => Promise<T>;
    respond: (outcome: T & { ok: true }) => unknown;
  },
): Promise<Response> {
  const user = await getCurrentUser(request, env);
  if (!user) return apiError(401, 'Sign in to read puzzle images.');
  if (!canCreate(user, env)) {
    return apiError(
      403,
      `Your account (${user.email}) isn't enabled for creating puzzles yet. Ask the site owner to add it.`,
    );
  }
  const apiKey = anthropicApiKey(env);
  if (!apiKey && !sender) return apiError(503, "Image parsing isn't set up on this server.");

  const declared = Number(request.headers.get('Content-Length') ?? 0);
  if (declared > MAX_IMAGE_BYTES + 64 * 1024)
    return apiError(413, 'That image is too large (10 MB at most).');

  let image: File;
  try {
    const field = (await request.formData()).get('image');
    if (!(field instanceof File)) return apiError(400, 'Choose an image to upload.');
    image = field;
  } catch {
    return apiError(400, 'Choose an image to upload.');
  }
  if (!isImageType(image.type)) return apiError(415, 'Use a JPEG, PNG, WebP or GIF image.');
  if (image.size > MAX_IMAGE_BYTES)
    return apiError(413, 'That image is too large (10 MB at most).');
  if (image.size === 0) return apiError(400, 'That image is empty.');

  const limited = await overLimits(env, user.id, now);
  if (limited) return limited;

  const data = Buffer.from(await image.arrayBuffer()).toString('base64');
  const send = sender ?? anthropicSender(new Anthropic({ apiKey }));
  const outcome = await steps.read(send, { data, mediaType: image.type });

  await recordParseRun(env.DB, {
    userId: user.id,
    createdAt: now,
    outcome: outcome.ok ? 'ok' : (outcome.reason ?? 'api-error'),
    model: outcome.model ?? null,
    inputTokens: (outcome.usage?.inputTokens ?? 0) + (outcome.usage?.cacheReadTokens ?? 0),
    outputTokens: outcome.usage?.outputTokens ?? 0,
    costUsd: outcome.costUsd ?? 0,
    durationMs: outcome.durationMs ?? null,
  });

  if (!outcome.ok) {
    return apiError(
      outcome.reason === 'api-error' ? 502 : 422,
      outcome.message ?? 'Reading failed.',
    );
  }
  return Response.json(steps.respond(outcome as T & { ok: true }));
}

/**
 * `POST /api/crosswords/clues`: sorts messy pasted clue text into Across and Down clues with
 * Claude (the editor's "Tidy with Claude"). Same rules as reading images: allowlisted creators,
 * the same hourly limit and daily budget, and every run logged for cost review.
 */
export async function tidyClueText(
  request: Request,
  env: Env,
  sender?: ClaudeSender,
  now = Date.now(),
): Promise<Response> {
  const user = await getCurrentUser(request, env);
  if (!user) return apiError(401, 'Sign in to tidy clues.');
  if (!canCreate(user, env)) {
    return apiError(
      403,
      `Your account (${user.email}) isn't enabled for creating puzzles yet. Ask the site owner to add it.`,
    );
  }
  const apiKey = anthropicApiKey(env);
  if (!apiKey && !sender) return apiError(503, "Tidying clues isn't set up on this server.");

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return apiError(400, 'Send the clue text as JSON.');
  }
  const parsed = validateWith(TidyCluesRequest, json);
  if (!parsed.ok) return apiError(400, 'Paste some clue text (30,000 characters at most).');

  const limited = await overLimits(env, user.id, now);
  if (limited) return limited;

  const send = sender ?? anthropicSender(new Anthropic({ apiKey }));
  // Sorting text is easy: low effort on the configured (cheap) model.
  const outcome = await tidyClues(send, parsed.value.text, {
    model: parseSettings(env).model,
    effort: 'low',
  });
  await recordParseRun(env.DB, {
    userId: user.id,
    createdAt: now,
    outcome: outcome.ok ? 'ok' : outcome.reason,
    model: outcome.model ?? null,
    inputTokens: (outcome.usage?.inputTokens ?? 0) + (outcome.usage?.cacheReadTokens ?? 0),
    outputTokens: outcome.usage?.outputTokens ?? 0,
    costUsd: outcome.costUsd ?? 0,
    durationMs: outcome.durationMs ?? null,
  });
  if (!outcome.ok) return apiError(outcome.reason === 'api-error' ? 502 : 422, outcome.message);

  const body: TidyCluesResponse = {
    clues: {
      across: [...outcome.clues.across],
      down: [...outcome.clues.down],
    },
    notes: [...outcome.notes],
    costUsd: outcome.costUsd,
  };
  return Response.json(body);
}

/** A 429 if this person or today's budget has hit the limits shared by all Claude features. */
async function overLimits(env: Env, userId: string, now: number): Promise<Response | null> {
  if ((await countParsesSince(env.DB, userId, now - HOUR_MS)) >= PARSES_PER_HOUR) {
    return apiError(
      429,
      `You've used Claude ${PARSES_PER_HOUR} times in the last hour. Please try again later.`,
    );
  }
  const budget = Number(env.PARSE_DAILY_BUDGET_USD) || 0;
  if ((await parseSpendSince(env.DB, startOfUtcDay(now))) >= budget) {
    return apiError(429, "Today's Claude budget is used up. Please try again tomorrow.");
  }
  return null;
}

/** The model and effort to use, from Worker settings (PARSE_MODEL, PARSE_EFFORT). */
export function parseSettings(env: Env): { model: string; effort: Effort } {
  const effort = env.PARSE_EFFORT;
  return {
    model: env.PARSE_MODEL || DEFAULT_MODEL,
    effort: isEffort(effort) ? effort : DEFAULT_EFFORT,
  };
}

function isImageType(type: string): type is ImageMediaType {
  return (IMAGE_MEDIA_TYPES as readonly string[]).includes(type);
}

function startOfUtcDay(now: number): number {
  const date = new Date(now);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function apiError(status: number, error: string): Response {
  const body: ApiError = { error };
  return Response.json(body, { status });
}
