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

type Failure = { ok: false; status: number; error: string };

export interface CallOptions {
  /** Give up after this long (default REQUEST_TIMEOUT_MS). */
  readonly timeoutMs?: number;
}

/**
 * Calls our API with a timeout and validates the response against a schema.
 * Failures come back as values with a message fit to show the user.
 */
export async function request<T>(
  url: string,
  schema: Parameters<typeof validateWith<T>>[0],
  init?: RequestInit,
  options?: CallOptions,
): Promise<ApiResult<T>> {
  const response = await call(url, init, options);
  if (!response.ok) return response;
  const parsed = validateWith(schema, response.json);
  return parsed.ok
    ? parsed
    : { ok: false, status: response.status, error: 'The server sent an unexpected response.' };
}

/** Like `request`, for calls that answer with no body (e.g. 204 No Content). */
export async function send(url: string, init: RequestInit): Promise<ApiResult<null>> {
  const response = await call(url, init);
  return response.ok ? { ok: true, value: null } : response;
}

/** Fetch with a timeout; turns network errors and error responses into readable failures. */
async function call(
  url: string,
  init?: RequestInit,
  options?: CallOptions,
): Promise<{ ok: true; status: number; json: unknown } | Failure> {
  const timeout = AbortSignal.timeout(options?.timeoutMs ?? REQUEST_TIMEOUT_MS);
  // The caller's signal (e.g. a Cancel button) and the timeout both stop the request.
  const signal = init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
  let res: Response;
  try {
    res = await fetch(url, { ...init, signal });
  } catch (error) {
    const name = error instanceof DOMException ? error.name : '';
    return {
      ok: false,
      status: 0,
      error:
        name === 'TimeoutError'
          ? 'The server took too long to respond. Please try again.'
          : name === 'AbortError' || init?.signal?.aborted
            ? 'Cancelled.'
            : "Couldn't reach the server. Check your connection.",
    };
  }

  const json: unknown = await res.json().catch(() => null);
  if (res.ok) return { ok: true, status: res.status, json };
  const error = validateWith(ApiError, json);
  const issues =
    error.ok && error.value.issues ? ` ${error.value.issues.map((i) => i.message).join(' ')}` : '';
  return {
    ok: false,
    status: res.status,
    error: error.ok ? `${error.value.error}${issues}` : `Request failed (${res.status}).`,
  };
}
