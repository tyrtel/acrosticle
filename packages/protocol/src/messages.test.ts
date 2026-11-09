import type { Letter } from '@acrosticle/core';
import { describe, expect, it } from 'vitest';
import {
  encodeMessage,
  MAX_NAME_LENGTH,
  parseClientMessage,
  parseServerMessage,
  type ServerMessage,
} from './messages';

const json = (value: unknown) => JSON.stringify(value);

describe('parseClientMessage', () => {
  it('parses join, trimming the name', () => {
    expect(parseClientMessage(json({ type: 'join', name: '  Ada ' }))).toEqual({
      ok: true,
      value: { type: 'join', name: 'Ada' },
    });
  });

  it('parses cell/set with a letter or null', () => {
    const set = { type: 'cell/set', cell: 4, value: 'Q', clientSeq: 0 };
    expect(parseClientMessage(json(set))).toEqual({ ok: true, value: set });
    expect(parseClientMessage(json({ ...set, value: null })).ok).toBe(true);
  });

  it('parses presence updates and ping', () => {
    expect(parseClientMessage(json({ type: 'presence/update', cell: null })).ok).toBe(true);
    expect(parseClientMessage(json({ type: 'presence/update', cell: 3 })).ok).toBe(true);
    expect(parseClientMessage(json({ type: 'ping' }))).toEqual({
      ok: true,
      value: { type: 'ping' },
    });
  });

  it('rejects malformed JSON', () => {
    expect(parseClientMessage('{not json')).toEqual({ ok: false, error: 'Invalid JSON' });
  });

  const set = { type: 'cell/set', cell: 1, value: 'A', clientSeq: 1 };
  it.each([
    ['unknown type', { type: 'nope' }],
    ['lowercase letter', { ...set, value: 'q' }],
    ['multi-char value', { ...set, value: 'AB' }],
    ['zero cell', { ...set, cell: 0 }],
    ['fractional cell', { ...set, cell: 1.5 }],
    ['missing clientSeq', { type: 'cell/set', cell: 1, value: 'A' }],
    ['negative clientSeq', { ...set, clientSeq: -1 }],
    ['blank name', { type: 'join', name: '   ' }],
    ['long name', { type: 'join', name: 'x'.repeat(MAX_NAME_LENGTH + 1) }],
  ])('rejects %s', (_label, message) => {
    expect(parseClientMessage(json(message)).ok).toBe(false);
  });
});

describe('parseServerMessage', () => {
  const snapshot: ServerMessage = {
    type: 'snapshot',
    puzzle: {
      grid: { columns: 2, rows: ['1A 2A'] },
      clues: [{ label: 'A', text: 'x', cells: [1, 2] }],
    },
    cells: [[1, 'Q' as Letter]],
    version: 3,
    you: 'm1',
    members: [{ id: 'm1', name: 'Ada', color: '#c00' }],
    presence: [['m1', 2]],
  };

  it.each<[string, ServerMessage]>([
    ['snapshot', snapshot],
    [
      'cell/updated',
      { type: 'cell/updated', cell: 2, value: null, version: 4, by: 'm1', clientSeq: 7 },
    ],
    ['presence', { type: 'presence', member: 'm1', cell: null }],
    ['member/joined', { type: 'member/joined', member: { id: 'm2', name: 'Bo', color: '#00c' } }],
    ['member/left', { type: 'member/left', member: 'm2' }],
    ['pong', { type: 'pong' }],
    ['error', { type: 'error', message: 'boom' }],
  ])('round-trips %s through encodeMessage', (_label, message) => {
    expect(parseServerMessage(encodeMessage(message))).toEqual({ ok: true, value: message });
  });

  it('rejects a snapshot with a bad letter', () => {
    expect(parseServerMessage(json({ ...snapshot, cells: [[1, 'q']] })).ok).toBe(false);
  });

  it('rejects client-only messages', () => {
    expect(parseServerMessage(json({ type: 'ping' })).ok).toBe(false);
  });
});
