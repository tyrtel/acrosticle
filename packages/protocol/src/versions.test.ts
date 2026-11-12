import { isEntry, type Entry } from '@acrosticle/core';
import { describe, expect, it } from 'vitest';
import type { ServerMessage } from './messages';
import {
  messageForVersion,
  PROTOCOL_VERSION,
  PROTOCOL_VERSION_PARAM,
  protocolVersionOf,
} from './versions';

const e = (value: string) => value as Entry;
const url = (query: string) => new URL(`https://example.com/api/rooms/abc/ws${query}`);

describe('protocolVersionOf', () => {
  it.each([
    ['', 1],
    ['?v=1', 1],
    ['?v=2', 2],
    ['?v=7', 7],
    ['?v=', 1],
    ['?v=0', 1],
    ['?v=-2', 1],
    ['?v=1.5', 1],
    ['?v=two', 1],
    ['?other=2', 1],
  ])('%j -> %i', (query, expected) => {
    expect(protocolVersionOf(url(query))).toBe(expected);
  });

  it('reads what a current client announces', () => {
    expect(protocolVersionOf(url(`?${PROTOCOL_VERSION_PARAM}=${PROTOCOL_VERSION}`))).toBe(
      PROTOCOL_VERSION,
    );
  });
});

describe('messageForVersion', () => {
  const snapshot: Extract<ServerMessage, { type: 'snapshot' }> = {
    type: 'snapshot',
    puzzle: {
      grid: { columns: 2, rows: ['1A 2A'] },
      clues: [{ label: 'A', text: 'x', cells: [1, 2] }],
    },
    cells: [
      [1, e('THE')],
      [2, e('Q')],
    ],
    version: 3,
    you: 'm1',
    members: [],
    presence: [],
  };
  const updated = (value: Entry | null): ServerMessage => ({
    type: 'cell/updated',
    cell: 1,
    value,
    version: 4,
    by: 'm1',
    clientSeq: 0,
  });

  it('sends current clients messages unchanged', () => {
    expect(messageForVersion(snapshot, PROTOCOL_VERSION)).toBe(snapshot);
    const message = updated(e('E or I'));
    expect(messageForVersion(message, PROTOCOL_VERSION)).toBe(message);
  });

  it("cuts a version 1 client's snapshot entries to their first character", () => {
    const legacy = messageForVersion(snapshot, 1);
    expect(legacy).toEqual({
      ...snapshot,
      cells: [
        [1, 'T'],
        [2, 'Q'],
      ],
    });
    expect(snapshot.cells[0]).toEqual([1, 'THE']);
  });

  it.each<[Entry | null, Entry | null]>([
    [e('E or I'), e('E')],
    [e('Q'), e('Q')],
    [null, null],
  ])("cuts a version 1 client's cell update %j to %j", (value, expected) => {
    expect(messageForVersion(updated(value), 1)).toEqual(updated(expected));
  });

  it('only sends version 1 clients one-character entries', () => {
    const legacy = messageForVersion(snapshot, 1);
    if (legacy.type !== 'snapshot') throw new Error('expected a snapshot');
    for (const [, entry] of legacy.cells) expect(isEntry(entry) && [...entry].length).toBe(1);
  });

  it('passes other messages through for version 1', () => {
    const message: ServerMessage = { type: 'presence', member: 'm1', cell: 2 };
    expect(messageForVersion(message, 1)).toBe(message);
  });
});
