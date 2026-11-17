import type { Message } from './parsePuzzleImage';
import type { TokenUsage } from './pricing';

/** Token counts from a Claude response, for costing. */
export function usageOf(message: Message): TokenUsage {
  return {
    inputTokens: message.usage.input_tokens,
    outputTokens: message.usage.output_tokens,
    cacheWriteTokens: message.usage.cache_creation_input_tokens ?? 0,
    cacheReadTokens: message.usage.cache_read_input_tokens ?? 0,
  };
}

/** Which Claude feature failed, for error wording. */
export type ClaudeFeature = 'images' | 'clues';

const WORDING: Record<ClaudeFeature, { feature: string; cancelled: string; input: string }> = {
  images: {
    feature: 'Image parsing',
    cancelled: 'Reading the puzzle was cancelled.',
    input: "This image couldn't be processed. Try a smaller or clearer image.",
  },
  clues: {
    feature: 'Tidying clues',
    cancelled: 'Tidying the clues was cancelled.',
    input: "That text couldn't be processed. Try a shorter piece.",
  },
};

/** What to tell people when the request to Claude itself failed. */
export function apiErrorMessage(error: unknown, about: ClaudeFeature = 'images'): string {
  const words = WORDING[about];
  const status =
    typeof error === 'object' && error !== null && 'status' in error
      ? (error as { status?: unknown }).status
      : undefined;
  if (error instanceof Error && error.name === 'AbortError') return words.cancelled;
  if (status === 401 || status === 403)
    return `${words.feature} isn't set up correctly on this server.`;
  if (status === 429) return `${words.feature} is busy right now. Please try again in a minute.`;
  if (status === 529 || (typeof status === 'number' && status >= 500)) {
    return `${words.feature} is temporarily unavailable. Please try again soon.`;
  }
  if (status === 400 || status === 413) return words.input;
  return `Couldn't reach Claude for ${words.feature.toLowerCase()}. Please try again.`;
}
