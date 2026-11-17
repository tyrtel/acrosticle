import { describe, expect, it } from 'vitest';
import { crosswordFromFile, type CrosswordFileData } from './file';
import { printedLength, reconcileWithClues } from './reconcile';

function read(file: CrosswordFileData) {
  const result = crosswordFromFile(file);
  if (!result.ok) throw new Error(result.error);
  return result.crossword;
}

describe('reconcileWithClues', () => {
  it('fixes a misread black square from the answer lengths', () => {
    //   1 2 3 #      (truly)
    //   4 . . .
    // Read with the black square missing, the grid numbers itself 1–4 down and 5 across.
    const misread = read({
      grid: ['....', '....'],
      clues: {
        across: [
          { number: 1, text: 'One (3)' },
          { number: 4, text: 'Four (4)' },
        ],
        down: [
          { number: 1, text: 'a (2)' },
          { number: 2, text: 'b (2)' },
          { number: 3, text: 'c (2)' },
        ],
      },
    });
    const printed = [
      { number: 1, row: 1, column: 1 },
      { number: 2, row: 1, column: 2 },
      { number: 3, row: 1, column: 3 },
      { number: 4, row: 2, column: 1 },
    ];
    const { crossword, notes } = reconcileWithClues(misread, printed);
    expect(crossword.squares[3]).toEqual({ kind: 'block' });
    expect(notes[0]).toMatch(/^Adjusted 1 square /);
  });

  it('adds and removes bars in a barred grid', () => {
    const misread = read({
      grid: ['...', '...'],
      bars: { right: [1], bottom: [] }, // a stray bar inside 1 Across
      clues: {
        across: [
          { number: 1, text: 'One (3)' },
          { number: 4, text: 'Two (2)' },
        ],
        down: [],
      },
    });
    const printed = [
      { number: 1, row: 1, column: 1 },
      { number: 4, row: 2, column: 1 },
    ];
    const { crossword } = reconcileWithClues(misread, printed);
    // 1 Across is whole; 4 Across ends after two squares (a bar right of cell 5).
    expect(crossword.bars?.right).toEqual([5]);
  });

  it('leaves grids alone without lengths, positions, or an improvement', () => {
    const plain = read({
      grid: ['..', '..'],
      clues: { across: [{ number: 1, text: 'No length' }], down: [] },
    });
    expect(reconcileWithClues(plain, [{ number: 1, row: 1, column: 1 }])).toEqual({
      crossword: plain,
      notes: [],
    });
    const rows = { ...plain, style: 'rows-columns' as const };
    expect(reconcileWithClues(rows, []).crossword).toBe(rows);
  });
});

describe('printedLength', () => {
  it.each([
    ['Fuel (3)', 3],
    ['Phrase (3,4)', 7],
    ['Hyphen (3-4)', 7],
    ['No length', null],
    ['(5) at the start', null],
  ])('%s → %s', (text, length) => {
    expect(printedLength(text)).toBe(length);
  });
});
