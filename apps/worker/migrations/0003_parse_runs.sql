-- Every image parse, for spending limits and cost review (design doc §6.6).
CREATE TABLE parse_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  -- 'ok', or why it failed: refusal, truncated, unreadable, api-error.
  outcome TEXT NOT NULL,
  model TEXT,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd REAL NOT NULL DEFAULT 0,
  duration_ms INTEGER
);
CREATE INDEX parse_runs_user_time ON parse_runs (user_id, created_at);
CREATE INDEX parse_runs_time ON parse_runs (created_at);
