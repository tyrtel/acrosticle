import { z } from 'zod';

/** The outcome of validating untrusted input. Expected failures are values, not exceptions. */
export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

/** Validates already-decoded data against a schema, with a readable error message. */
export function validateWith<T>(schema: z.ZodType<T>, data: unknown): ParseResult<T> {
  const result = schema.safeParse(data);
  return result.success
    ? { ok: true, value: result.data }
    : { ok: false, error: z.prettifyError(result.error) };
}
