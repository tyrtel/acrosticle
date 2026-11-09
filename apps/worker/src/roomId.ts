import { randomToken } from './encoding';

/** A new unguessable room id: 128 random bits, base64url-encoded (22 characters). */
export function newRoomId(): string {
  return randomToken(16);
}
