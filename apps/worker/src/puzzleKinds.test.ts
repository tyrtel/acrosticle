import { describe, expect, it } from 'vitest';
import { miniCrosswordFile } from '../tests/support/crosswords';
import { tinyPuzzleFile } from '../tests/support/rooms';
import { checkPuzzle } from './puzzleKinds';

describe('checkPuzzle', () => {
  it('reports an acrostic: its cells are its printed numbers', () => {
    const result = checkPuzzle(tinyPuzzleFile);
    if (!result.ok) throw new Error(result.error);
    expect(result.puzzle.kind).toBe('acrostic');
    expect(result.puzzle.title).toBe('Tiny');
    expect([...result.puzzle.cells].sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it('reports a crossword: its cells are its open squares', () => {
    const result = checkPuzzle(miniCrosswordFile);
    if (!result.ok) throw new Error(result.error);
    expect(result.puzzle.kind).toBe('crossword');
    expect(result.puzzle.cells.size).toBe(19);
    expect(result.puzzle.cells.has(4)).toBe(false);
    expect(result.puzzle.cells.has(13)).toBe(true);
  });

  it('rejects unreadable files (400) and puzzles with errors (422)', () => {
    expect(checkPuzzle({ ...tinyPuzzleFile, grid: { columns: 4, rows: ['1A ??'] } })).toMatchObject(
      {
        ok: false,
        status: 400,
      },
    );
    expect(
      checkPuzzle({ ...tinyPuzzleFile, grid: { columns: 4, rows: ['1A 2A # 3A', '4B # 5A'] } }),
    ).toMatchObject({ ok: false, status: 422 });
    expect(
      checkPuzzle({ kind: 'crossword', grid: ['##', '##'], clues: { across: [], down: [] } }),
    ).toMatchObject({ ok: false, status: 422, issues: [{ code: 'no-squares' }] });
  });
});
