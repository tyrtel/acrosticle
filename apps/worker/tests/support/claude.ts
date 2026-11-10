import { vi } from 'vitest';

const MESSAGES_URL = 'https://api.anthropic.com/v1/messages';

export interface FakeReply {
  readonly text?: string;
  readonly stopReason?: string;
  readonly status?: number;
  readonly inputTokens?: number;
  readonly outputTokens?: number;
}

/**
 * Answers the Anthropic SDK's requests with a streamed (server-sent events)
 * reply in the real API format, so the real SDK runs end to end. Returns the
 * request bodies Claude "received".
 */
export function mockClaude(reply: FakeReply | ((body: Record<string, unknown>) => FakeReply)) {
  const realFetch = globalThis.fetch;
  const bodies: Record<string, unknown>[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const request = input instanceof Request ? input : new Request(String(input), init);
    if (!request.url.startsWith(MESSAGES_URL)) return realFetch(input, init);
    const body = await request.json<Record<string, unknown>>();
    bodies.push(body);
    const answer = typeof reply === 'function' ? reply(body) : reply;
    if (answer.status && answer.status >= 400) {
      return Response.json(
        { type: 'error', error: { type: 'api_error', message: 'fake failure' } },
        { status: answer.status },
      );
    }
    return new Response(sse(answer), { headers: { 'Content-Type': 'text/event-stream' } });
  });
  return bodies;
}

function sse({
  text = '',
  stopReason = 'end_turn',
  inputTokens = 5000,
  outputTokens = 8000,
}: FakeReply) {
  const events: [string, unknown][] = [
    [
      'message_start',
      {
        type: 'message_start',
        message: {
          id: 'msg_fake',
          type: 'message',
          role: 'assistant',
          model: 'claude-opus-5-5',
          content: [],
          stop_reason: null,
          stop_sequence: null,
          usage: { input_tokens: inputTokens, output_tokens: 1 },
        },
      },
    ],
    [
      'content_block_start',
      { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
    ],
    [
      'content_block_delta',
      { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } },
    ],
    ['content_block_stop', { type: 'content_block_stop', index: 0 }],
    [
      'message_delta',
      {
        type: 'message_delta',
        delta: { stop_reason: stopReason, stop_sequence: null },
        usage: { output_tokens: outputTokens },
      },
    ],
    ['message_stop', { type: 'message_stop' }],
  ];
  return events.map(([name, data]) => `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`).join('');
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
