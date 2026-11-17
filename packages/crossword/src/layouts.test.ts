import { emptySolveState, type Entry } from '@gridicles/core';
import { describe, expect, it } from 'vitest';
import { formatClueText, parseClueText } from './clueText';
import { buildCrosswordIndex } from './crosswordIndex';
import { blankCrossword, resizeCrossword, toggleBar } from './editing';
import { crosswordFromFile, crosswordToFile, type CrosswordFileData } from './file';
import { crosswordFromIpuz } from './ipuz';
import { typeInCrossword } from './navigation';
import { columnLabel } from './puzzle';
import { validateCrossword } from './validateCrossword';

const none = { across: [], down: [] };
function read(file: CrosswordFileData) {
  const result = crosswordFromFile(file);
  if (!result.ok) throw new Error(result.error);
  return result.crossword;
}
const shape = (index: ReturnType<typeof buildCrosswordIndex>) => ({
  across: index.words('across').map((w) => [w.label, w.cells]),
  down: index.words('down').map((w) => [w.label, w.cells]),
});

//   1  2  3 |4
//   5  6  7  8
//   ‾‾       (bars under 5 and 6)
//   9 10 11 12
describe('barred grids', () => {
  // A bar right of cell 3 splits row 1; bars under cells 5 and 6 split columns 1 and 2.
  const barred = read({
    grid: ['....', '....', '....'],
    bars: { right: [3], bottom: [5, 6] },
    clues: none,
  });
  const index = buildCrosswordIndex(barred);

  it('ends words at bars and numbers the grid accordingly', () => {
    expect(shape(index)).toEqual({
      across: [
        ['1', [1, 2, 3]],
        ['5', [5, 6, 7, 8]],
        ['6', [9, 10, 11, 12]],
      ],
      down: [
        ['1', [1, 5]],
        ['2', [2, 6]],
        ['3', [3, 7, 11]],
        ['4', [4, 8, 12]],
      ],
    });
    expect(index.hasBar(3, 'right')).toBe(true);
    expect(index.hasBar(5, 'bottom')).toBe(true);
    expect(index.hasBar(4, 'right')).toBe(false);
  });

  it('typing stops at a bar, as at the end of any word', () => {
    expect(
      typeInCrossword(index, emptySolveState, { cell: 3, direction: 'across' }, 'X' as Entry),
    ).toMatchObject({ selection: { cell: 3, direction: 'across' } });
  });

  it('round-trips bars through the file format', () => {
    expect(crosswordToFile(barred).bars).toEqual({ right: [3], bottom: [5, 6] });
    expect(read(crosswordToFile(barred))).toEqual(barred);
  });

  it('rejects a bar off the grid', () => {
    expect(crosswordFromFile({ grid: ['..'], bars: { right: [9] }, clues: none })).toMatchObject({
      ok: false,
    });
  });

  it('reads .ipuz bars on any edge', () => {
    const result = crosswordFromIpuz({
      dimensions: { width: 2, height: 2 },
      puzzle: [
        [
          { cell: 1, style: { barred: 'R' } },
          { cell: 2, style: { barred: 'B' } },
        ],
        [{ cell: 3, style: { barred: 'TL' } }, 0],
      ],
      clues: {},
    });
    if (!result.ok) throw new Error(result.error);
    // Cell 3's left edge is the grid's edge, so only its top bar (under cell 1) counts.
    expect(result.crossword.bars).toEqual({ right: [1], bottom: [1, 2] });
  });
});

describe('editing bars', () => {
  it('toggles a bar and its mirror, or alone', () => {
    const blank = blankCrossword(3, 3);
    // Right of cell 1 (row 1, between columns 1-2) mirrors to right of cell 8 (row 3, columns 2-3).
    expect(toggleBar(blank, 1, 'right', true).bars).toEqual({ right: [1, 8], bottom: [] });
    // Under cell 1 mirrors to under cell 6 (between rows 2-3, column 3).
    expect(toggleBar(blank, 1, 'bottom', true).bars).toEqual({ right: [], bottom: [1, 6] });
    const once = toggleBar(blank, 1, 'right', false);
    expect(once.bars).toEqual({ right: [1], bottom: [] });
    expect(toggleBar(once, 1, 'right', false).bars).toEqual({ right: [], bottom: [] });
    expect(() => toggleBar(blank, 10, 'right', true)).toThrow(RangeError);
  });

  it('keeps bars with their squares when the grid is resized', () => {
    const grid = toggleBar(blankCrossword(3, 3), 5, 'right', false); // row 2, column 2
    expect(resizeCrossword(grid, 4, 3).bars).toEqual({ right: [6], bottom: [] });
    expect(resizeCrossword(grid, 2, 2).bars).toEqual({ right: [4], bottom: [] });
    expect(resizeCrossword(grid, 1, 1).bars).toEqual({ right: [4], bottom: [] }); // 2×2 at least
  });
});

describe('rows-and-columns puzzles', () => {
  const puzzle = read({
    style: 'rows-columns',
    grid: ['...', '...'],
    clues: {
      across: [{ number: 1, text: 'First / Second' }],
      down: [{ number: 2, text: 'Column B clue (9)' }],
    },
  });
  const index = buildCrosswordIndex(puzzle);

  it('makes every row and column one word, labelled 1, 2… and A, B…, with no numbers', () => {
    expect(shape(index)).toEqual({
      across: [
        ['1', [1, 2, 3]],
        ['2', [4, 5, 6]],
      ],
      down: [
        ['A', [1, 4]],
        ['B', [2, 5]],
        ['C', [3, 6]],
      ],
    });
    expect(index.numberAt(1)).toBeUndefined();
    expect(index.wordNumbered('down', 2)?.clue).toBe('Column B clue (9)');
  });

  it("doesn't check printed lengths (rows hold several clues)", () => {
    expect(validateCrossword(index).map((i) => i.code)).not.toContain('length-mismatch');
  });

  it('writes and reads ROWS and COLUMNS text, with lettered columns', () => {
    const text = formatClueText(puzzle.clues, 'rows-columns');
    expect(text).toBe('ROWS\n1. First / Second\n\nCOLUMNS\nB. Column B clue (9)');
    expect(parseClueText(text)).toEqual({ clues: puzzle.clues, problems: [] });
    expect(parseClueText('Columns\nAA. Far right').clues.down).toEqual([
      { number: 27, text: 'Far right' },
    ]);
  });

  it('round-trips the style through the file format', () => {
    expect(crosswordToFile(puzzle).style).toBe('rows-columns');
    expect(read(crosswordToFile(puzzle))).toEqual(puzzle);
  });
});

describe('columnLabel', () => {
  it.each([
    [0, 'A'],
    [25, 'Z'],
    [26, 'AA'],
    [27, 'AB'],
  ])('column %i is %s', (index, label) => {
    expect(columnLabel(index)).toBe(label);
  });
});

describe('clueNumberFit', () => {
  it('is 1 when the grid numbers itself as the clues do, less otherwise, null without clues', async () => {
    const { clueNumberFit } = await import('./reconcile');
    const grid = read({
      grid: ['..', '..'],
      clues: {
        across: [
          { number: 1, text: 'a' },
          { number: 3, text: 'b' },
        ],
        down: [
          { number: 1, text: 'c' },
          { number: 2, text: 'd' },
        ],
      },
    });
    expect(clueNumberFit(grid)).toBe(1);
    expect(
      clueNumberFit({ ...grid, clues: { across: [{ number: 5, text: 'x' }], down: [] } }),
    ).toBe(0);
    expect(clueNumberFit({ ...grid, clues: none })).toBeNull();
  });
});
