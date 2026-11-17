import { describe, expect, it, vi } from 'vitest';
import type { ClaudeSender, Message } from './parsePuzzleImage';
import {
  buildCrosswordRequest,
  parseCrosswordImage,
  readCrosswordExtraction,
} from './parseCrosswordImage';

const image = { data: 'AAAA', mediaType: 'image/png' as const };
const extraction = (overrides: Record<string, unknown> = {}) =>
  JSON.stringify({
    title: 'Mini',
    author: '',
    instructions: 'Every answer is an animal.',
    style: 'standard',
    width: 3,
    height: 2,
    rows: ['..#', '...'],
    bars: [],
    across: [{ number: 1, text: 'Cat (2)' }],
    down: [{ number: 1, text: 'Dog (2)' }],
    notes: [],
    ...overrides,
  });
function reply(text: string, stop_reason = 'end_turn'): Message {
  return {
    model: 'claude-haiku-5-5',
    stop_reason,
    content: [{ type: 'text', text }],
    usage: { input_tokens: 1000, output_tokens: 500 },
  } as unknown as Message;
}

describe('buildCrosswordRequest', () => {
  it('sends the image with the crossword instructions and schema', () => {
    const request = buildCrosswordRequest(image, { model: 'claude-haiku-5-5', effort: 'medium' });
    expect(JSON.stringify(request.messages)).toContain('"media_type":"image/png"');
    expect(JSON.stringify(request.system)).toContain('Barred grids');
    expect(request.output_config?.effort).toBe('medium');
  });
});

describe('readCrosswordExtraction', () => {
  it('turns the answer into a crossword file, with instructions as notes', () => {
    expect(readCrosswordExtraction(extraction())).toEqual({
      file: {
        kind: 'crossword',
        title: 'Mini',
        notes: 'Every answer is an animal.',
        grid: ['..#', '...'],
        clues: { across: [{ number: 1, text: 'Cat (2)' }], down: [{ number: 1, text: 'Dog (2)' }] },
      },
      notes: [],
    });
  });

  it('keeps bars on inner edges only, and the rows-and-columns style', () => {
    const read = readCrosswordExtraction(
      extraction({
        style: 'rows-columns',
        bars: [
          { row: 1, column: 1, side: 'right' },
          { row: 1, column: 3, side: 'right' }, // the outer edge
          { row: 1, column: 2, side: 'bottom' },
          { row: 2, column: 2, side: 'bottom' }, // the outer edge
          { row: 9, column: 1, side: 'right' }, // off the grid
        ],
      }),
    );
    expect(read?.file.style).toBe('rows-columns');
    expect(read?.file.bars).toEqual({ right: [1], bottom: [2] });
  });

  it('evens out ragged rows instead of failing, with a note', () => {
    const read = readCrosswordExtraction(extraction({ rows: ['.X#.', '.'], width: 3, height: 3 }));
    expect(read?.file.grid).toEqual(['..#', '...', '...']);
    expect(read?.notes).toEqual([
      "The grid's rows didn't all come out 3 squares wide; check the grid.",
    ]);
  });

  it('gives up on an answer with no grid at all', () => {
    expect(readCrosswordExtraction(extraction({ rows: [], width: 0, height: 0 }))).toBeNull();
    expect(readCrosswordExtraction('nope')).toBeNull();
  });
});

describe('parseCrosswordImage', () => {
  it('returns the draft with run facts', async () => {
    const send: ClaudeSender = vi.fn().mockResolvedValue(reply(extraction()));
    const outcome = await parseCrosswordImage(send, image, { model: 'claude-haiku-5-5' });
    expect(outcome).toMatchObject({ ok: true, file: { title: 'Mini' }, model: 'claude-haiku-5-5' });
  });

  it.each([
    ['a refusal', reply('', 'refusal'), 'refusal'],
    ['running out of room', reply('{', 'max_tokens'), 'truncated'],
    ['an unreadable answer', reply('{}'), 'unreadable'],
  ])('reports %s', async (_label, message, reason) => {
    const send: ClaudeSender = vi.fn().mockResolvedValue(message);
    expect(await parseCrosswordImage(send, image)).toMatchObject({ ok: false, reason });
  });

  it('reports a failed request', async () => {
    const send: ClaudeSender = vi
      .fn()
      .mockRejectedValue(Object.assign(new Error('x'), { status: 529 }));
    expect(await parseCrosswordImage(send, image)).toMatchObject({
      ok: false,
      reason: 'api-error',
    });
  });
});
