import { isLetter } from '@acrosticle/core';
import { z } from 'zod';
import { validateWith, type ParseResult } from './parseResult';

/**
 * Messages sent over the room WebSocket. Both sides validate everything they
 * receive with these schemas; nothing from the network is trusted as typed.
 */

const cellNumber = z.number().int().positive();
const letterOrNull = z
  .string()
  .refine(isLetter, 'must be a single uppercase letter A-Z')
  .nullable();

export const ClientMessage = z.discriminatedUnion('type', [
  z.object({ type: z.literal('cell/set'), cell: cellNumber, value: letterOrNull }),
  z.object({ type: z.literal('ping') }),
]);
export type ClientMessage = z.infer<typeof ClientMessage>;

export const ServerMessage = z.discriminatedUnion('type', [
  z.object({ type: z.literal('cell/updated'), cell: cellNumber, value: letterOrNull }),
  z.object({ type: z.literal('pong') }),
  z.object({ type: z.literal('error'), message: z.string() }),
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
