import { MeResponse, MyRoomsResponse } from '@acrosticle/protocol';
import { request, send, type ApiResult } from '../../lib/api';

export function fetchMe(): Promise<ApiResult<MeResponse>> {
  return request('/api/me', MeResponse);
}

export function fetchMyRooms(): Promise<ApiResult<MyRoomsResponse>> {
  return request('/api/me/rooms', MyRoomsResponse);
}

/** Deletes a room for everyone (creator only). */
export function deleteRoom(roomId: string): Promise<ApiResult<null>> {
  return send(`/api/rooms/${roomId}`, { method: 'DELETE' });
}

/** Ends the session. Errors are ignored: the next /api/me shows the real state. */
export async function signOut(): Promise<void> {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
  } catch {
    // Offline: nothing more we can do here.
  }
}
