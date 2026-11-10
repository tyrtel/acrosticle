import { isEntry } from '@acrosticle/core';
import { z } from 'zod';
import { validateWith, type ParseResult } from './parseResult';
import { PuzzleFile } from './puzzleFile';

/**
 * Messages sent over the room WebSocket. Both sides validate everything they
 * receive with these schemas; nothing from the network is trusted as typed.
 *
 * Flow: the client connects and sends `join`; the server replies with a
 * `snapshot` and then streams changes. Every accepted edit is broadcast to
 * everyone (sender included) as `cell/updated`, carrying the room version.
 */

const cellNumber = z.number().int().positive();
const entry = z.string().refine(isEntry, 'must be one letter, digit or symbol (no spaces)');
const entryOrNull = entry.nullable();
const memberId = z.string().min(1).max(64);

export const MAX_NAME_LENGTH = 40;

export const Member = z.object({
  id: memberId,
  name: z.string(),
  /** A CSS color for this member's cursor. */
  color: z.string(),
});
export type Member = z.infer<typeof Member>;

export const ClientMessage = z.discriminatedUnion('type', [
  z.object({ type: z.literal('join'), name: z.string().trim().min(1).max(MAX_NAME_LENGTH) }),
  z.object({
    type: z.literal('cell/set'),
    cell: cellNumber,
    value: entryOrNull,
    /** Client-chosen sequence number, echoed back so the sender can confirm its edit. */
    clientSeq: z.number().int().nonnegative(),
  }),
  z.object({ type: z.literal('presence/update'), cell: cellNumber.nullable() }),
  z.object({ type: z.literal('ping') }),
]);
export type ClientMessage = z.infer<typeof ClientMessage>;

export const ServerMessage = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('snapshot'),
    puzzle: PuzzleFile,
    /** Filled cells as [cell, letter] pairs. */
    cells: z.array(z.tuple([cellNumber, entry])),
    version: z.number().int().nonnegative(),
    /** The receiving client's own member id. */
    you: memberId,
    members: z.array(Member),
    presence: z.array(z.tuple([memberId, cellNumber])),
  }),
  z.object({
    type: z.literal('cell/updated'),
    cell: cellNumber,
    value: entryOrNull,
    version: z.number().int().positive(),
    by: memberId,
    clientSeq: z.number().int().nonnegative(),
  }),
  z.object({ type: z.literal('presence'), member: memberId, cell: cellNumber.nullable() }),
  z.object({ type: z.literal('member/joined'), member: Member }),
  z.object({ type: z.literal('member/left'), member: memberId }),
  z.object({ type: z.literal('pong') }),
  z.object({ type: z.literal('error'), message: z.string() }),
  /** The creator deleted the room; the connection closes right after. */
  z.object({ type: z.literal('room/deleted') }),
]);
export type ServerMessage = z.infer<typeof ServerMessage>;

export function parseClientMessage(raw: string): ParseResult<ClientMessage> {
  return parseWith(ClientMessage, raw);
}

export function parseServerMessage(raw: string): ParseResult<ServerMessage> {
  return parseWith(ServerMessage, raw);
}

export function encodeMessage(message: ClientMessage | ServerMessage): string {
  return JSON.stringify(message);
}

function parseWith<T>(schema: z.ZodType<T>, raw: string): ParseResult<T> {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { ok: false, error: 'Invalid JSON' };
  }
  return validateWith(schema, json);
}
