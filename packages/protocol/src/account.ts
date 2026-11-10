import { z } from 'zod';
import { RoomId } from './rooms';

export const AccountUser = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  picture: z.string().nullable(),
});
export type AccountUser = z.infer<typeof AccountUser>;

/** Response to `GET /api/me`. */
export const MeResponse = z.object({
  user: AccountUser.nullable(),
  /** Whether this user may create rooms for their own puzzles (signed in and on the allowlist). */
  canCreate: z.boolean(),
  /** Whether Google sign-in is set up on this server. */
  signInConfigured: z.boolean(),
});
export type MeResponse = z.infer<typeof MeResponse>;

/** Response to `GET /api/me/rooms`: rooms the signed-in user created or joined, most recently active first. */
export const MyRoomsResponse = z.object({
  rooms: z.array(
    z.object({
      roomId: RoomId,
      title: z.string().nullable(),
      createdAt: z.number().int(),
      /** When anyone last edited the room (to within about 30 seconds). */
      updatedAt: z.number().int(),
      /** Only the creator can delete a room. */
      createdByMe: z.boolean(),
    }),
  ),
});
export type MyRoomsResponse = z.infer<typeof MyRoomsResponse>;

/** Query values for `?signin=` after the sign-in flow returns to the app. */
export const SIGN_IN_RESULTS = ['cancelled', 'failed', 'unverified', 'unconfigured'] as const;
export type SignInResult = (typeof SIGN_IN_RESULTS)[number];

/** Where to start Google sign-in, returning to `returnTo` (a same-site path) afterwards. */
export function signInPath(returnTo: string): string {
  return `/api/auth/google?returnTo=${encodeURIComponent(returnTo)}`;
}
