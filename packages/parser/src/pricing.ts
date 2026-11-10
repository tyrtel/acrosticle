/**
 * Claude prices in US dollars per million tokens. Keep this the only place
 * prices live: update it when Anthropic's pricing changes.
 * Source: Anthropic pricing, cached in the claude-api skill (2026-10-06).
 * Haiku 5.5's prices apply to prompts up to 100K tokens (ours are far smaller);
 * its cache prices aren't listed there, so they assume the usual ratios.
 */
export const PRICING_USD_PER_MTOK: Readonly<
  Record<string, { input: number; output: number; cacheWrite: number; cacheRead: number }>
> = {
  'claude-opus-5-5': { input: 4, output: 20, cacheWrite: 5, cacheRead: 0.2 },
  'claude-sonnet-5-5': { input: 2, output: 10, cacheWrite: 2.5, cacheRead: 0.2 },
  'claude-haiku-5-5': { input: 0.1, output: 0.5, cacheWrite: 0.125, cacheRead: 0.01 },
};

export interface TokenUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cacheWriteTokens: number;
  readonly cacheReadTokens: number;
}

/** The cost of a request, or null if the model isn't in the price table. */
export function costUsd(model: string, usage: TokenUsage): number | null {
  const price = PRICING_USD_PER_MTOK[model];
  if (!price) return null;
  const dollars =
    usage.inputTokens * price.input +
    usage.outputTokens * price.output +
    usage.cacheWriteTokens * price.cacheWrite +
    usage.cacheReadTokens * price.cacheRead;
  return dollars / 1_000_000;
}

import type { Effort } from './parsePuzzleImage';

/**
 * Rough upper estimate of one parse's cost, before running it: about 6,000
 * input tokens (the image plus the prompt) and output that grows with effort
 * (the transcription is ~7,000 tokens; the rest is thinking). Measure with the
 * eval to replace guesses with real numbers.
 */
export const ESTIMATED_OUTPUT_TOKENS: Readonly<Record<Effort, number>> = {
  low: 9_000,
  medium: 13_000,
  high: 18_000,
  xhigh: 24_000,
  max: 32_000,
};

export function estimateParseCostUsd(model: string, effort: Effort): number | null {
  return costUsd(model, {
    inputTokens: 6_000,
    outputTokens: ESTIMATED_OUTPUT_TOKENS[effort],
    cacheWriteTokens: 0,
    cacheReadTokens: 0,
  });
}
