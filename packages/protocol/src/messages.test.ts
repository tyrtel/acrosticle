import { describe, expect, it } from 'vitest';
import { encodeMessage, parseClientMessage, parseServerMessage } from './messages';

describe('parseClientMessage', () => {
  it('parses a valid cell/set message', () => {
    const result = parseClientMessage('{"type":"cell/set","cell":4,"value":"Q"}');
    expect(result).toEqual({ ok: true, value: { type: 'cell/set', cell: 4, value: 'Q' } });
  });

  it('accepts null to clear a cell', () => {
    const result = parseClientMessage('{"type":"cell/set","cell":4,"value":null}');
    expect(result.ok).toBe(true);
  });

  it('parses ping', () => {
    expect(parseClientMessage('{"type":"ping"}')).toEqual({ ok: true, value: { type: 'ping' } });
  });

  it('rejects malformed JSON', () => {
    expect(parseClientMessage('{not json')).toEqual({ ok: false, error: 'Invalid JSON' });
  });

  it.each([
    ['unknown type', '{"type":"nope"}'],
    ['lowercase letter', '{"type":"cell/set","cell":1,"value":"q"}'],
    ['multi-char value', '{"type":"cell/set","cell":1,"value":"AB"}'],
    ['zero cell', '{"type":"cell/set","cell":0,"value":"A"}'],
    ['fractional cell', '{"type":"cell/set","cell":1.5,"value":"A"}'],
    ['missing cell', '{"type":"cell/set","value":"A"}'],
  ])('rejects %s', (_label, raw) => {
    expect(parseClientMessage(raw).ok).toBe(false);
  });
});

describe('parseServerMessage', () => {
  it('round-trips through encodeMessage', () => {
    const raw = encodeMessage({ type: 'error', message: 'boom' });
    expect(parseServerMessage(raw)).toEqual({
      ok: true,
      value: { type: 'error', message: 'boom' },
    });
  });

  it('rejects client-only messages', () => {
    expect(parseServerMessage('{"type":"ping"}').ok).toBe(false);
  });
});
