import { MeResponse, MyRoomsResponse } from '@acrosticle/protocol';
import { request, type ApiResult } from '../../lib/api';

export function fetchMe(): Promise<ApiResult<MeResponse>> {
  return request('/api/me', MeResponse);
}

export function fetchMyRooms(): Promise<ApiResult<MyRoomsResponse>> {
  return request('/api/me/rooms', MyRoomsResponse);
}

/** Ends the session. Errors are ignored: the next /api/me shows the real state. */
export async function signOut(): Promise<void> {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
  } catch {
    // Offline: nothing more we can do here.
  }
}
