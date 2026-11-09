import { puzzleToCompact, type Puzzle } from '@acrosticle/core';
import {
  ApiError,
  CreateRoomResponse,
  RoomInfoResponse,
  validateWith,
  type CreateRoomRequest,
} from '@acrosticle/protocol';

/** Give up on a request that hasn't answered in this long. */
export const REQUEST_TIMEOUT_MS = 15_000;

export type ApiResult<T> = { ok: true; value: T } | { ok: false; status: number; error: string };

/** Creates a room for a (valid) puzzle and returns its id. */
export async function createRoom(puzzle: Puzzle): Promise<ApiResult<string>> {
  const body: CreateRoomRequest = { puzzle: puzzleToCompact(puzzle) };
  const result = await request('/api/rooms', CreateRoomResponse, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return result.ok ? { ok: true, value: result.value.roomId } : result;
}

/** Checks a room exists and returns its public info. */
export function getRoomInfo(roomId: string): Promise<ApiResult<RoomInfoResponse>> {
  return request(`/api/rooms/${roomId}`, RoomInfoResponse);
}

async function request<T>(
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
