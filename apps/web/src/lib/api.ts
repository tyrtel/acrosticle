import { ApiError, validateWith } from '@acrosticle/protocol';

/** Give up on a request that hasn't answered in this long. */
export const REQUEST_TIMEOUT_MS = 15_000;

export type ApiResult<T> = { ok: true; value: T } | { ok: false; status: number; error: string };

/** Request options for a POST with a JSON body. */
export function jsonBody(value: unknown): RequestInit {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(value),
  };
}

/**
 * Calls our API with a timeout and validates the response against a schema.
 * Failures come back as values with a message fit to show the user.
 */
export async function request<T>(
  url: string,
  schema: Parameters<typeof validateWith<T>>[0],
  init?: RequestInit,
): Promise<ApiResult<T>> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === 'TimeoutError';
    return {
      ok: false,
      status: 0,
      error: timedOut
        ? 'The server took too long to respond. Please try again.'
        : "Couldn't reach the server. Check your connection.",
    };
  }

  const json: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const error = validateWith(ApiError, json);
    const issues =
      error.ok && error.value.issues
        ? ` ${error.value.issues.map((i) => i.message).join(' ')}`
        : '';
    return {
      ok: false,
      status: res.status,
      error: error.ok ? `${error.value.error}${issues}` : `Request failed (${res.status}).`,
    };
  }

  const parsed = validateWith(schema, json);
  return parsed.ok
    ? parsed
    : { ok: false, status: res.status, error: 'The server sent an unexpected response.' };
}
