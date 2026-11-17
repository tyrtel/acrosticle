-- Rooms are acrostics or crosswords (docs/planning/crosswords.md). Both sites share this database,
-- so My puzzles can list rooms from both and link each to its own site.
ALTER TABLE rooms ADD COLUMN kind TEXT NOT NULL DEFAULT 'acrostic';
