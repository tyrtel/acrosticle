import { z } from 'zod';
import { PuzzleFile } from './puzzleFile';

/** Room ids are unguessable (128 random bits, base64url); the link is the access control. */
export const ROOM_ID_PATTERN = /^[A-Za-z0-9_-]{22}$/;
export const RoomId = z.string().regex(ROOM_ID_PATTERN, 'not a valid room id');

/** Built-in sample puzzles, which anyone may start a room for without signing in. */
export const SAMPLE_IDS = ['diplo-crostic-37'] as const;
export const SampleId = z.enum(SAMPLE_IDS);
export type SampleId = z.infer<typeof SampleId>;

/**
 * Body of `POST /api/rooms`: either a puzzle file (signed-in, allowlisted users) or the id of a
 * built-in sample (anyone; the server uses its own copy).
 */
export const CreateRoomRequest = z.union([
  // Checked first, so a request naming a sample always uses the server's copy.
  z.object({ sample: SampleId }),
  z.object({ puzzle: PuzzleFile }),
]);
export type CreateRoomRequest = z.infer<typeof CreateRoomRequest>;

/** Response to `POST /api/rooms` (201). */
export const CreateRoomResponse = z.object({ roomId: RoomId });
export type CreateRoomResponse = z.infer<typeof CreateRoomResponse>;

/** Response to `GET /api/rooms/:id`: public facts about a room, before joining. */
export const RoomInfoResponse = z.object({ roomId: RoomId, title: z.string().nullable() });
export type RoomInfoResponse = z.infer<typeof RoomInfoResponse>;

/** Error body for any failed API request. */
export const ApiError = z.object({
  error: z.string(),
  /** Validation problems, when a puzzle was rejected. */
  issues: z.array(z.object({ code: z.string(), message: z.string() })).optional(),
});
export type ApiError = z.infer<typeof ApiError>;

export function roomPath(roomId: string): string {
  return `/r/${roomId}`;
}

export function roomSocketPath(roomId: string): string {
  return `/api/rooms/${roomId}/ws`;
}
