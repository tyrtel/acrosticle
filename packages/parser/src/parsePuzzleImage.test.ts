import { describe, expect, it } from 'vitest';
import { claudeMessage, fakeSender, tinyExtraction } from '../tests/fakeClaude';
import { buildRequest, parsePuzzleImage, type PuzzleImage } from './parsePuzzleImage';
import { costUsd, estimateParseCostUsd } from './pricing';

const image: PuzzleImage = { data: 'aGVsbG8=', mediaType: 'image/jpeg' };
const ok = (json: unknown) => claudeMessage({ text: JSON.stringify(json) });

describe('buildRequest', () => {
  it('asks Opus 5.5 for structured output from the image, with refusal fallbacks and a cached prompt', () => {
    const request = buildRequest(image);
    expect(request).toMatchObject({
      model: 'claude-opus-5-5',
      max_tokens: 64_000,
      stream: true,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'high', format: { type: 'json_schema' } },
    });
    expect(request.system).toMatchObject([{ type: 'text', cache_control: { type: 'ephemeral' } }]);
    expect(request.messages[0]?.content).toMatchObject([
      { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: 'aGVsbG8=' } },
      { type: 'text' },
    ]);
    expect(request).not.toHaveProperty('thinking'); // adaptive thinking is the default
  });

  it('sends refusal fallbacks only to models that accept them', () => {
    expect(buildRequest(image, { model: 'claude-sonnet-5-5' })).toMatchObject({
      fallbacks: 'default',
    });
    const haiku = buildRequest(image, { model: 'claude-haiku-5-5', effort: 'low' });
    expect(haiku).not.toHaveProperty('fallbacks');
    expect(haiku).not.toHaveProperty('betas');
    expect(haiku).toMatchObject({ model: 'claude-haiku-5-5', output_config: { effort: 'low' } });
  });

  it('accepts model, effort and max_tokens overrides', () => {
    expect(
      buildRequest(image, { model: 'claude-sonnet-5-5', effort: 'low', maxTokens: 9 }),
    ).toMatchObject({
      model: 'claude-sonnet-5-5',
      max_tokens: 9,
      output_config: { effort: 'low' },
    });
  });
});

describe('parsePuzzleImage', () => {
  it('returns the draft puzzle file, notes, validation issues, usage and cost', async () => {
    const send = fakeSender(
      claudeMessage({
        text: JSON.stringify(tinyExtraction),
        usage: { input: 6_000, output: 4_000 },
      }),
    );
    const result = await parsePuzzleImage(send, image);
    if (!result.ok) throw new Error(result.message);

    expect(result.file).toEqual({
      title: 'Tiny',
      grid: { columns: 4, rows: ['1A 2B # 3A', '4B # 5A'] },
      clues: tinyExtraction.clues,
    });
    expect(result.notes).toEqual(['Square 5 was faint.']);
    expect(result.issues).toEqual([]);
    expect(result.usage).toEqual({
      inputTokens: 6_000,
      outputTokens: 4_000,
      cacheWriteTokens: 0,
      cacheReadTokens: 0,
    });
    expect(result.costUsd).toBeCloseTo(0.024 + 0.08);
    expect(result.model).toBe('claude-opus-5-5');
    expect(send.requests).toHaveLength(1);
  });

  it('keeps misprints as printed, reporting them as validation issues', async () => {
    const misprint = { ...tinyExtraction, rows: ['1A 2A # 3A', '4B # 5A'] };
    const result = await parsePuzzleImage(fakeSender(ok(misprint)), image);
    expect(result.ok && result.issues.map((i) => i.code)).toEqual(['label-mismatch']);
  });

  it('drops empty notes and a blank title', async () => {
    const result = await parsePuzzleImage(
      fakeSender(ok({ ...tinyExtraction, title: '', notes: ['', '  '] })),
      image,
    );
    expect(result.ok && result.notes).toEqual([]);
    expect(result.ok && result.file).not.toHaveProperty('title');
  });

  it.each([
    ['not JSON', 'here is the puzzle'],
    ['the wrong shape', JSON.stringify({ hello: 'there' })],
    ['a bad grid token', JSON.stringify({ ...tinyExtraction, rows: ['1A ?? # 3A'] })],
    ['zero columns', JSON.stringify({ ...tinyExtraction, columns: 0 })],
    ['JSON that is not an object', '42'],
  ])('reports unreadable output: %s', async (_label, text) => {
    const result = await parsePuzzleImage(fakeSender(claudeMessage({ text })), image);
    expect(result).toMatchObject({ ok: false, reason: 'unreadable' });
    expect(result.costUsd).toBeGreaterThan(0); // the attempt still cost something
  });

  it('reports a refusal', async () => {
    const result = await parsePuzzleImage(
      fakeSender(claudeMessage({ stopReason: 'refusal' })),
      image,
    );
    expect(result).toMatchObject({ ok: false, reason: 'refusal' });
  });

  it('reports output cut off at max_tokens', async () => {
    const text = JSON.stringify(tinyExtraction).slice(0, 40);
    const result = await parsePuzzleImage(
      fakeSender(claudeMessage({ text, stopReason: 'max_tokens' })),
      image,
    );
    expect(result).toMatchObject({ ok: false, reason: 'truncated' });
  });

  it.each([
    [{ status: 429 }, 'busy'],
    [{ status: 401 }, "isn't set up correctly"],
    [{ status: 529 }, 'temporarily unavailable'],
    [{ status: 400 }, "couldn't be processed"],
    [new TypeError('fetch failed'), "Couldn't reach"],
  ])('turns API errors into messages (%o)', async (error, text) => {
    const thrown = error instanceof Error ? error : Object.assign(new Error('api'), error);
    const result = await parsePuzzleImage(fakeSender(thrown), image);
    expect(result).toMatchObject({ ok: false, reason: 'api-error' });
    expect(!result.ok && result.message).toContain(text);
  });

  it('reports cancellation', async () => {
    const abort = Object.assign(new Error('aborted'), { name: 'AbortError' });
    const result = await parsePuzzleImage(fakeSender(abort), image);
    expect(!result.ok && result.message).toBe('Reading the puzzle was cancelled.');
  });
});

describe('costUsd', () => {
  it('prices every kind of token', () => {
    expect(
      costUsd('claude-opus-5-5', {
        inputTokens: 1_000_000,
        outputTokens: 1_000_000,
        cacheWriteTokens: 1_000_000,
        cacheReadTokens: 1_000_000,
      }),
    ).toBeCloseTo(4 + 20 + 5 + 0.2);
  });

  it('returns null for an unknown model', () => {
    expect(
      costUsd('claude-unknown', {
        inputTokens: 1,
        outputTokens: 1,
        cacheWriteTokens: 0,
        cacheReadTokens: 0,
      }),
    ).toBeNull();
  });
});

describe('estimateParseCostUsd', () => {
  it('estimates cheapest for Haiku at low effort and most for Opus at high effort', () => {
    const haiku = estimateParseCostUsd('claude-haiku-5-5', 'low') ?? Infinity;
    const sonnet = estimateParseCostUsd('claude-sonnet-5-5', 'medium') ?? Infinity;
    const opus = estimateParseCostUsd('claude-opus-5-5', 'high') ?? Infinity;
    expect(haiku).toBeCloseTo(0.0051, 4);
    expect(sonnet).toBeCloseTo(0.142, 3);
    expect(opus).toBeCloseTo(0.384, 3);
  });

  it('returns null for an unknown model', () => {
    expect(estimateParseCostUsd('claude-unknown', 'low')).toBeNull();
  });
});
