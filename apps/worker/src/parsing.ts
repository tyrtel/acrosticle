import { hasErrors } from '@gridicles/acrostic';
import {
  anthropicSender,
  DEFAULT_EFFORT,
  DEFAULT_MODEL,
  IMAGE_MEDIA_TYPES,
  isEffort,
  parsePuzzleImage,
  tidyClues,
  type Effort,
  type ClaudeSender,
  type ImageMediaType,
} from '@gridicles/parser';
import {
  TidyCluesRequest,
  validateWith,
  type ApiError,
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

  if ((await countParsesSince(env.DB, user.id, now - HOUR_MS)) >= PARSES_PER_HOUR) {
    return apiError(
      429,
      `You've read ${PARSES_PER_HOUR} images in the last hour. Please try again later.`,
    );
  }
  const budget = Number(env.PARSE_DAILY_BUDGET_USD) || 0;
  if ((await parseSpendSince(env.DB, startOfUtcDay(now))) >= budget) {
    return apiError(429, "Today's image-reading budget is used up. Please try again tomorrow.");
  }

  const data = Buffer.from(await image.arrayBuffer()).toString('base64');
  const send = sender ?? anthropicSender(new Anthropic({ apiKey }));
  const outcome = await parsePuzzleImage(send, { data, mediaType: image.type }, parseSettings(env));

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

  const body: ParsePuzzleResponse = {
    file: outcome.file,
    notes: [...outcome.notes],
    issues: outcome.issues.map(({ code, severity, message }) => ({ code, severity, message })),
    needsFixes: hasErrors(outcome.issues),
    costUsd: outcome.costUsd,
  };
  return Response.json(body);
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
