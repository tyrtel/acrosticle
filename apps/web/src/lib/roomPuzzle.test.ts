import { describe, expect, it } from 'vitest';
import mini from '../../../../samples/puzzles/gridicles-mini-1.json';
import { readRoomPuzzle, roomPuzzleTitle } from './roomPuzzle';
import type { PuzzleFile } from '@gridicles/protocol';

const acrostic: PuzzleFile = {
  title: 'Tiny',
  grid: { columns: 2, rows: ['1A 2A'] },
  clues: [{ label: 'A', text: 'x', cells: [1, 2] }],
};

describe('readRoomPuzzle', () => {
  it('reads an acrostic (files without a kind are acrostics)', () => {
    const result = readRoomPuzzle(acrostic);
    expect(result.ok && result.value.kind).toBe('acrostic');
    expect(result.ok && roomPuzzleTitle(result.value)).toBe('Tiny');
  });

  it('reads a crossword', () => {
    const result = readRoomPuzzle(mini as PuzzleFile);
    expect(result.ok && result.value.kind).toBe('crossword');
    expect(result.ok && roomPuzzleTitle(result.value)).toBe('Gridicles Mini No. 1');
  });

  it('reports unreadable puzzles of either kind', () => {
    expect(readRoomPuzzle({ ...acrostic, grid: { columns: 2, rows: ['1A ??'] } }).ok).toBe(false);
    expect(
      readRoomPuzzle({ kind: 'crossword', grid: ['AB', 'C'], clues: { across: [], down: [] } }),
    ).toEqual({ ok: false, error: 'Row 2 has 1 squares, but row 1 has 2.' });
  });
});
