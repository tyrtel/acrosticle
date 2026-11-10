-- My puzzles lists rooms you created or joined, most recently active first (features.md F2).

-- When anyone last edited the room (written at most every 30 seconds per room).
ALTER TABLE rooms ADD COLUMN updated_at INTEGER;
UPDATE rooms SET updated_at = created_at;

-- Rooms signed-in users have joined.
CREATE TABLE room_visits (
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  room_id TEXT NOT NULL,
  last_visited_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, room_id)
);
CREATE INDEX room_visits_room_id ON room_visits (room_id);
