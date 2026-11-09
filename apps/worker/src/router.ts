import { hasErrors, puzzleFromCompact, validatePuzzle } from '@acrosticle/core';
import {
  CreateRoomRequest,
  ROOM_ID_PATTERN,
  validateWith,
  type ApiError,
  type CreateRoomResponse,
  type RoomInfoResponse,
} from '@acrosticle/protocol';
import { getCurrentUser } from './auth';
import { newRoomId } from './roomId';

/** Puzzle files are a few KB; anything much larger is a mistake or abuse. */
export const MAX_CREATE_BODY_BYTES = 100_000;

const ROOM_PATH = /^\/api\/rooms\/([^/]+)(\/ws)?$/;

/** Top-level HTTP routing. Keep handlers thin; real logic lives in the room or in core. */
export async function route(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);

  if (url.pathname === '/api/health' && request.method === 'GET') {
    return Response.json({ status: 'ok' });
  }

  if (url.pathname === '/api/rooms' && request.method === 'POST') {
    return createRoom(request, env);
  }

  const roomMatch = ROOM_PATH.exec(url.pathname);
  const roomId = roomMatch?.[1];
  if (roomId !== undefined && ROOM_ID_PATTERN.test(roomId)) {
    const room = env.PUZZLE_ROOM.getByName(roomId);
    if (roomMatch?.[2]) return room.fetch(request);
    if (request.method === 'GET') return roomInfo(roomId, await room.info());
  }

  return apiError(404, 'Not found');
}

async function createRoom(request: Request, env: Env): Promise<Response> {
  const user = getCurrentUser(request, env);
  if (!user) return apiError(401, 'Sign in to create a puzzle room.');

  const body = await request.text();
  if (new TextEncoder().encode(body).length > MAX_CREATE_BODY_BYTES) {
    return apiError(413, 'Puzzle file is too large.');
  }

  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    return apiError(400, 'Request body is not valid JSON.');
  }

  const parsed = validateWith(CreateRoomRequest, json);
  if (!parsed.ok) return apiError(400, `Invalid request: ${parsed.error}`);

  const converted = puzzleFromCompact(parsed.value.puzzle);
  if (!converted.ok) return apiError(400, `Invalid puzzle: ${converted.error}`);

  const issues = validatePuzzle(converted.puzzle);
  if (hasErrors(issues)) {
    const errors = issues
      .filter((issue) => issue.severity === 'error')
      .map(({ code, message }) => ({ code, message }));
    return apiError(422, 'The puzzle has errors. Fix them before creating a room.', errors);
  }

  const roomId = newRoomId();
  const created = await env.PUZZLE_ROOM.getByName(roomId).initialize(parsed.value.puzzle, user.id);
  if (!created) return apiError(500, 'Could not create the room. Please try again.');

  const response: CreateRoomResponse = { roomId };
  return Response.json(response, { status: 201 });
}

function roomInfo(roomId: string, info: { title: string | null } | null): Response {
  if (!info) return apiError(404, 'Room not found');
  const response: RoomInfoResponse = { roomId, title: info.title };
  return Response.json(response);
}

function apiError(status: number, error: string, issues?: ApiError['issues']): Response {
  const body: ApiError = issues ? { error, issues } : { error };
  return Response.json(body, { status });
}
