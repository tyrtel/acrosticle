-- Accounts, sessions, and the list of rooms (design doc §7.4).

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  google_sub TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  picture_url TEXT,
  created_at INTEGER NOT NULL,
  last_login_at INTEGER NOT NULL
);

-- Only a SHA-256 hash of each session token is stored; the token itself lives in the cookie.
CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX sessions_user_id ON sessions (user_id);

-- Every room ever created. created_by is null for anonymous sample rooms.
CREATE TABLE rooms (
  room_id TEXT PRIMARY KEY,
  created_by TEXT REFERENCES users (id) ON DELETE SET NULL,
  title TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX rooms_created_by ON rooms (created_by, created_at);
