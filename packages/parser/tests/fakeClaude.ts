import type Anthropic from '@anthropic-ai/sdk';
import type { ClaudeSender } from '../src';

type Message = Anthropic.Beta.Messages.BetaMessage;

/** A final message as Claude would return it (only the fields the parser reads). */
export function claudeMessage({
  text = '',
  stopReason = 'end_turn',
  model = 'claude-opus-5-5',
  usage = {},
}: {
  text?: string;
  stopReason?: string;
  model?: string;
  usage?: Partial<{ input: number; output: number; cacheWrite: number; cacheRead: number }>;
}): Message {
  return {
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    model,
    stop_reason: stopReason,
    stop_sequence: null,
    content: text ? [{ type: 'text', text, citations: null }] : [],
    usage: {
      input_tokens: usage.input ?? 5_000,
      output_tokens: usage.output ?? 10_000,
      cache_creation_input_tokens: usage.cacheWrite ?? 0,
      cache_read_input_tokens: usage.cacheRead ?? 0,
    },
  } as unknown as Message;
}

/** A sender that records requests and answers with the given message (or throws). */
export function fakeSender(answer: Message | Error): ClaudeSender & {
  requests: Parameters<ClaudeSender>[0][];
} {
  const requests: Parameters<ClaudeSender>[0][] = [];
  const send = (params: Parameters<ClaudeSender>[0]) => {
    requests.push(params);
    return answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer);
  };
  return Object.assign(send, { requests });
}

/** A small, valid extraction (Claude's JSON). */
export const tinyExtraction = {
  title: 'Tiny',
  constructedBy: null,
  columns: 4,
  rows: ['1A 2B # 3A', '4B # 5A'],
  clues: [
    { label: 'A', text: 'First', cells: [3, 1, 5] },
    { label: 'B', text: 'Second', cells: [4, 2] },
  ],
  notes: ['Square 5 was faint.'],
};
