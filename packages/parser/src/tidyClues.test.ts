import { describe, expect, it, vi } from 'vitest';
import type { ClaudeSender, Message } from './parsePuzzleImage';
import { buildTidyRequest, tidyClues } from './tidyClues';

function reply(text: string, stop_reason = 'end_turn'): Message {
  return {
    model: 'claude-haiku-5-5',
    stop_reason,
    content: [{ type: 'text', text }],
    usage: { input_tokens: 100, output_tokens: 50 },
  } as unknown as Message;
}
const sender = (message: Message): ClaudeSender => vi.fn().mockResolvedValue(message);
const options = { model: 'claude-haiku-5-5' };

describe('buildTidyRequest', () => {
  it('sends the text with the clue-sorting instructions and schema, at low effort by default', () => {
    const request = buildTidyRequest('1 Fuel', options);
    expect(request.model).toBe('claude-haiku-5-5');
    expect(request.output_config?.effort).toBe('low');
    expect(JSON.stringify(request.messages)).toContain('1 Fuel');
    expect(JSON.stringify(request.system)).toContain('Never');
  });
});

describe('tidyClues', () => {
  it('returns the clues, trimmed, dropping malformed ones, with notes', async () => {
    const json = JSON.stringify({
      across: [{ number: 1, text: ' Fuel ' }, { number: 0, text: 'bad' }, { text: 'no number' }],
      down: [{ number: 2, text: 'Two' }],
      notes: ['unsure', ''],
    });
    const outcome = await tidyClues(sender(reply(json)), 'x', options);
    expect(outcome).toMatchObject({
      ok: true,
      clues: { across: [{ number: 1, text: 'Fuel' }], down: [{ number: 2, text: 'Two' }] },
      notes: ['unsure'],
    });
  });

  it.each([
    ['a refusal', reply('', 'refusal'), 'refusal'],
    ['running out of room', reply('{', 'max_tokens'), 'truncated'],
    ['no clues', reply('{"across":[],"down":[],"notes":[]}'), 'unreadable'],
    ['not JSON', reply('nope'), 'unreadable'],
  ])('reports %s', async (_label, message, reason) => {
    expect(await tidyClues(sender(message), 'x', options)).toMatchObject({ ok: false, reason });
  });

  it('reports a failed request in terms of clues', async () => {
    const failing: ClaudeSender = vi
      .fn()
      .mockRejectedValue(Object.assign(new Error('x'), { status: 429 }));
    const outcome = await tidyClues(failing, 'x', options);
    expect(outcome).toEqual({
      ok: false,
      reason: 'api-error',
      message: 'Tidying clues is busy right now. Please try again in a minute.',
    });
  });
});
