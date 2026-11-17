import { firstCharacter } from '@acrosticle/core';
import type { ServerMessage } from './messages';

/**
 * The room protocol version this code speaks, announced by the client in the
 * WebSocket URL. History: 1 = one character per square (tabs from before
 * versioning send no version); 2 = multi-character entries (ADR 0005);
 * 3 = highlighted squares (`cell/marked`, snapshot `marks`).
 */
export const PROTOCOL_VERSION = 3;

/** The query parameter carrying the client's protocol version. */
export const PROTOCOL_VERSION_PARAM = 'v';

/** What a client older than PROTOCOL_VERSION is told on joining. */
export const OUTDATED_CLIENT_MESSAGE = 'This page is out of date. Reload to keep solving.';

/** The protocol version a client announced in its WebSocket URL (1 if none or unreadable). */
export function protocolVersionOf(url: URL): number {
  const announced = Number(url.searchParams.get(PROTOCOL_VERSION_PARAM));
  return Number.isInteger(announced) && announced >= 1 ? announced : 1;
}

/**
 * A server message as a client speaking `version` can read it, or null if it
 * has nothing that client understands. Version 1 clients reject a whole
 * message containing a multi-character entry, so they get only each entry's
 * first character. Clients before version 3 don't know highlights; they skip
 * the unknown snapshot field but would reject `cell/marked`.
 */
export function messageForVersion(message: ServerMessage, version: number): ServerMessage | null {
  if (message.type === 'cell/marked' && version < 3) return null;
  if (version >= 2) return message;
  if (message.type === 'snapshot') {
    return {
      ...message,
      cells: message.cells.map(([cell, entry]) => [cell, firstCharacter(entry)]),
    };
  }
  if (message.type === 'cell/updated' && message.value !== null) {
    return { ...message, value: firstCharacter(message.value) };
  }
  return message;
}
