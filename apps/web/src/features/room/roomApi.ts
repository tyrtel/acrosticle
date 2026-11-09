import { puzzleToCompact, type Puzzle } from '@acrosticle/core';
import {
  CreateRoomResponse,
  RoomInfoResponse,
  type CreateRoomRequest,
  type SampleId,
} from '@acrosticle/protocol';
import { jsonBody, request, type ApiResult } from '../../lib/api';

/** Creates a room for a (valid) puzzle and returns its id. Needs an allowlisted account. */
export async function createRoom(puzzle: Puzzle): Promise<ApiResult<string>> {
  const body: CreateRoomRequest = { puzzle: puzzleToCompact(puzzle) };
  return postRoom(body);
}

/** Creates a room for a built-in sample (no sign-in needed) and returns its id. */
export function createSampleRoom(sample: SampleId): Promise<ApiResult<string>> {
  return postRoom({ sample });
}

async function postRoom(body: CreateRoomRequest): Promise<ApiResult<string>> {
  const result = await request('/api/rooms', CreateRoomResponse, jsonBody(body));
  return result.ok ? { ok: true, value: result.value.roomId } : result;
}

/** Checks a room exists and returns its public info. */
export function getRoomInfo(roomId: string): Promise<ApiResult<RoomInfoResponse>> {
  return request(`/api/rooms/${roomId}`, RoomInfoResponse);
}
