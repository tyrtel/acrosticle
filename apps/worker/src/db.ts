import { randomToken, sha256Hex } from './encoding';

/** Database access for accounts, sessions and the room list (D1, see migrations/). */

export interface Account {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly picture: string | null;
}

export interface GoogleIdentity {
  readonly sub: string;
  readonly email: string;
  readonly name: string;
  readonly picture: string | null;
}

const DAY_MS = 86_400_000;
export const SESSION_TTL_MS = 30 * DAY_MS;
/** Sessions are pushed back out to 30 days once fewer than this many days remain. */
export const EXTEND_BELOW_MS = 15 * DAY_MS;

/** Creates or updates the account for a Google identity and returns its id. */
export async function upsertGoogleUser(
  db: D1Database,
  identity: GoogleIdentity,
  now: number,
): Promise<string> {
  const row = await db
    .prepare(
      `INSERT INTO users (id, google_sub, email, name, picture_url, created_at, last_login_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (google_sub) DO UPDATE SET
         email = excluded.email,
         name = excluded.name,
         picture_url = excluded.picture_url,
         last_login_at = excluded.last_login_at
       RETURNING id`,
    )
    .bind(
      crypto.randomUUID(),
      identity.sub,
      identity.email,
      identity.name,
      identity.picture,
      now,
      now,
    )
    .first<{ id: string }>();
  if (!row) throw new Error('Upserting the user returned no row');
  return row.id;
}

/** Starts a session and returns its token (only a hash of it is stored). */
export async function createSession(db: D1Database, userId: string, now: number): Promise<string> {
  const token = randomToken(32);
  await db
    .prepare(
      'INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)',
    )
    .bind(await sha256Hex(token), userId, now, now + SESSION_TTL_MS)
    .run();
  return token;
}

export interface FoundSession {
  readonly account: Account;
  readonly expiresAt: number;
}

/** The account for a session token, or null if unknown or expired (expired ones are removed). */
export async function findSession(
  db: D1Database,
  token: string,
  now: number,
): Promise<FoundSession | null> {
  const tokenHash = await sha256Hex(token);
  const row = await db
    .prepare(
      `SELECT s.expires_at, u.id, u.name, u.email, u.picture_url
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ?`,
    )
    .bind(tokenHash)
    .first<{
      expires_at: number;
      id: string;
      name: string;
      email: string;
      picture_url: string | null;
    }>();
  if (!row) return null;
  if (row.expires_at <= now) {
    await db.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(tokenHash).run();
    return null;
  }
  return {
    account: { id: row.id, name: row.name, email: row.email, picture: row.picture_url },
    expiresAt: row.expires_at,
  };
}

/** Pushes a session's expiry out to the full lifetime. Returns the new expiry. */
export async function extendSession(db: D1Database, token: string, now: number): Promise<number> {
  const expiresAt = now + SESSION_TTL_MS;
  await db
    .prepare('UPDATE sessions SET expires_at = ? WHERE token_hash = ?')
    .bind(expiresAt, await sha256Hex(token))
    .run();
  return expiresAt;
}

export async function deleteSession(db: D1Database, token: string): Promise<void> {
  await db
    .prepare('DELETE FROM sessions WHERE token_hash = ?')
    .bind(await sha256Hex(token))
    .run();
}

export async function recordRoom(
  db: D1Database,
  room: { roomId: string; createdBy: string | null; title: string | null; createdAt: number },
): Promise<void> {
  await db
    .prepare('INSERT INTO rooms (room_id, created_by, title, created_at) VALUES (?, ?, ?, ?)')
    .bind(room.roomId, room.createdBy, room.title, room.createdAt)
    .run();
}

export async function listRoomsCreatedBy(
  db: D1Database,
  userId: string,
): Promise<{ roomId: string; title: string | null; createdAt: number }[]> {
  const { results } = await db
    .prepare(
      `SELECT room_id, title, created_at FROM rooms
       WHERE created_by = ? ORDER BY created_at DESC, room_id`,
    )
    .bind(userId)
    .all<{ room_id: string; title: string | null; created_at: number }>();
  return results.map((r) => ({ roomId: r.room_id, title: r.title, createdAt: r.created_at }));
}
