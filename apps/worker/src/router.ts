import { hasErrors, puzzleFromCompact, validatePuzzle } from '@acrosticle/core';
import {
  CreateRoomRequest,
  ROOM_ID_PATTERN,
  validateWith,
  type ApiError,
  type CreateRoomResponse,
  type PuzzleFile,
  type RoomInfoResponse,
} from '@acrosticle/protocol';
import { appOrigin, canCreate, getCurrentUser } from './auth';
import { finishGoogleSignIn, logout, me, myRooms, startGoogleSignIn } from './authRoutes';
import { deleteRoomRecords, recordRoom, recordVisit, roomCreator } from './db';
import { ROOM_ID_HEADER } from './room/PuzzleRoom';
import { parsePuzzle } from './parsing';
import { newRoomId } from './roomId';
import { SAMPLE_PUZZLES } from './samples';

/** Puzzle files are a few KB; anything much larger is a mistake or abuse. */
export const MAX_CREATE_BODY_BYTES = 100_000;

const ROOM_PATH = /^\/api\/rooms\/([^/]+)(\/ws)?$/;

/** Top-level HTTP routing. Keep handlers thin; real logic lives in the room or in core. */
export async function route(
  request: Request,
  env: Env,
  ctx: Pick<ExecutionContext, 'waitUntil'>,
): Promise<Response> {
  const url = new URL(request.url);
  const { method } = request;

  // Defense in depth on top of SameSite cookies: state-changing requests from
  // a browser must come from our own pages.
  const origin = request.headers.get('Origin');
  const changesState = method !== 'GET' && method !== 'HEAD';
  if (changesState && origin !== null && origin !== appOrigin(request, env)) {
    return apiError(403, 'Cross-site requests are not allowed.');
  }

  switch (`${method} ${url.pathname}`) {
    case 'GET /api/health':
      return Response.json({ status: 'ok' });
    case 'POST /api/rooms':
      return createRoom(request, env);
    case 'GET /api/auth/google':
      return startGoogleSignIn(request, env);
    case 'GET /api/auth/google/callback':
      return finishGoogleSignIn(request, env);
    case 'POST /api/auth/logout':
      return logout(request, env);
    case 'GET /api/me':
      return me(request, env);
    case 'GET /api/me/rooms':
      return myRooms(request, env);
    case 'POST /api/puzzles/parse':
      return parsePuzzle(request, env);
  }

  const roomMatch = ROOM_PATH.exec(url.pathname);
  const roomId = roomMatch?.[1];
  if (roomId !== undefined && ROOM_ID_PATTERN.test(roomId)) {
    const room = env.PUZZLE_ROOM.getByName(roomId);
    if (roomMatch?.[2]) return joinRoom(request, env, ctx, roomId);
    if (method === 'GET') return roomInfo(roomId, await room.info());
    if (method === 'DELETE') return deleteRoom(request, env, roomId);
  }

  return apiError(404, 'Not found');
}

async function createRoom(request: Request, env: Env): Promise<Response> {
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
  const user = await getCurrentUser(request, env);

  let puzzle: PuzzleFile;
  if ('sample' in parsed.value) {
    // Anyone may start a room for a built-in sample; the puzzle is the server's own copy.
    puzzle = SAMPLE_PUZZLES[parsed.value.sample];
  } else {
    if (!user) return apiError(401, 'Sign in to create a room for your own puzzle.');
    if (!canCreate(user, env)) {
      return apiError(
        403,
        `Your account (${user.email}) isn't enabled for creating puzzles yet. Ask the site owner to add it.`,
      );
    }
    const issues = puzzleIssues(parsed.value.puzzle);
    if (issues) return issues;
    puzzle = parsed.value.puzzle;
  }

  const roomId = newRoomId();
  const createdBy = user?.id ?? null;
  const created = await env.PUZZLE_ROOM.getByName(roomId).initialize(roomId, puzzle, createdBy);
  if (!created) return apiError(500, 'Could not create the room. Please try again.');
  await recordRoom(env.DB, {
    roomId,
    createdBy,
    title: puzzle.title ?? null,
    createdAt: Date.now(),
  });

  const response: CreateRoomResponse = { roomId };
  return Response.json(response, { status: 201 });
}

/** A 400/422 response if the puzzle can't be used, or null if it's fine. */
function puzzleIssues(file: PuzzleFile): Response | null {
  const converted = puzzleFromCompact(file);
  if (!converted.ok) return apiError(400, `Invalid puzzle: ${converted.error}`);
  const issues = validatePuzzle(converted.puzzle);
  if (!hasErrors(issues)) return null;
  const errors = issues
    .filter((issue) => issue.severity === 'error')
    .map(({ code, message }) => ({ code, message }));
  return apiError(422, 'The puzzle has errors. Fix them before creating a room.', errors);
}

/** WebSocket upgrade into a room; signed-in users get the room added to My puzzles. */
async function joinRoom(
  request: Request,
  env: Env,
  ctx: Pick<ExecutionContext, 'waitUntil'>,
  roomId: string,
): Promise<Response> {
  // Tell the room its own id (rooms created before ids were stored learn it here).
  const forwarded = new Request(request);
  forwarded.headers.set(ROOM_ID_HEADER, roomId);
  const response = await env.PUZZLE_ROOM.getByName(roomId).fetch(forwarded);
  if (response.status === 101) {
    ctx.waitUntil(
      getCurrentUser(request, env).then(
        (user) => user && recordVisit(env.DB, user.id, roomId, Date.now()),
      ),
    );
  }
  return response;
}

/** `DELETE /api/rooms/:id`: the creator removes the room and its progress for everyone. */
async function deleteRoom(request: Request, env: Env, roomId: string): Promise<Response> {
  const user = await getCurrentUser(request, env);
  if (!user) return apiError(401, 'Sign in to delete a puzzle.');
  const creator = await roomCreator(env.DB, roomId);
  if (creator === undefined) return apiError(404, 'Room not found');
  if (creator !== user.id)
    return apiError(403, 'Only the person who created a puzzle can delete it.');

  await env.PUZZLE_ROOM.getByName(roomId).destroy();
  await deleteRoomRecords(env.DB, roomId);
  return new Response(null, { status: 204 });
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
