import { emptySolveState, type Entry, type SolveState } from '@gridicles/core';
import { describe, expect, it } from 'vitest';
import { miniIndex } from '../tests/support/mini';
import { buildCrosswordIndex } from './crosswordIndex';
import { crosswordFromFile } from './file';
import {
  arrowInCrossword,
  atTabEnd,
  clickSquare,
  currentWord,
  enterWord,
  eraseInCrossword,
  initialCrosswordSelection,
  jumpInCrossword,
  saveInCrossword,
  tabOrder,
  toggleDirection,
  typeInCrossword,
  type CrosswordSelection,
} from './navigation';

const index = miniIndex();
const e = (s: string) => s as Entry;
const filled = (...cells: number[]): SolveState =>
  Object.fromEntries(cells.map((cell) => [cell, e('X')]));
const across = (cell: number): CrosswordSelection => ({ cell, direction: 'across' });
const down = (cell: number): CrosswordSelection => ({ cell, direction: 'down' });

describe('typing', () => {
  it('writes the entry and moves to the next square of the word', () => {
    expect(typeInCrossword(index, emptySolveState, across(11), e('S'))).toEqual({
      edit: { cell: 11, value: 'S' },
      selection: across(12),
    });
    expect(typeInCrossword(index, emptySolveState, down(3), e('S')).selection).toEqual(down(8));
  });

  it('skips squares that are already filled', () => {
    expect(typeInCrossword(index, filled(12, 13), across(11), e('S')).selection).toEqual(
      across(14),
    );
  });

  it('typing over an entry replaces it and still moves to the next empty square', () => {
    const move = typeInCrossword(index, filled(11, 12), across(11), e('S'));
    expect(move.edit).toEqual({ cell: 11, value: 'S' });
    expect(move.selection).toEqual(across(13));
  });

  it("goes to the word's last square when the rest of the word is filled", () => {
    expect(typeInCrossword(index, filled(12, 13, 14, 15), across(11), e('S')).selection).toEqual(
      across(15),
    );
  });

  it("stops on the word's last square instead of jumping to the next clue", () => {
    expect(typeInCrossword(index, emptySolveState, across(15), e('E')).selection).toEqual(
      across(15),
    );
  });

  it('a multi-letter entry moves on like typing; an empty one clears in place', () => {
    expect(saveInCrossword(index, emptySolveState, across(6), e('AB'))).toEqual({
      edit: { cell: 6, value: 'AB' },
      selection: across(7),
    });
    expect(saveInCrossword(index, filled(6), across(6), null)).toEqual({
      edit: { cell: 6, value: null },
      selection: across(6),
    });
    expect(saveInCrossword(index, emptySolveState, across(6), null).edit).toBeNull();
    // Saving what's already there moves on without an edit.
    expect(saveInCrossword(index, filled(6), across(6), e('X'))).toEqual({
      edit: null,
      selection: across(7),
    });
  });
});

describe('erasing', () => {
  it('clears a filled square in place', () => {
    expect(eraseInCrossword(index, filled(12), across(12))).toEqual({
      edit: { cell: 12, value: null },
      selection: across(12),
    });
  });

  it('on an empty square, steps back in the word and clears that', () => {
    expect(eraseInCrossword(index, filled(11), across(12))).toEqual({
      edit: { cell: 11, value: null },
      selection: across(11),
    });
    expect(eraseInCrossword(index, emptySolveState, down(8))).toEqual({
      edit: null,
      selection: down(3),
    });
  });

  it("stays at a word's first square", () => {
    expect(eraseInCrossword(index, emptySolveState, across(11))).toEqual({
      edit: null,
      selection: across(11),
    });
  });
});

describe('arrows', () => {
  it('an arrow across the typing direction switches direction without moving', () => {
    expect(arrowInCrossword(index, across(13), 'down')).toEqual(down(13));
    expect(arrowInCrossword(index, across(13), 'up')).toEqual(down(13));
    expect(arrowInCrossword(index, down(13), 'left')).toEqual(across(13));
  });

  it('an arrow along the typing direction moves exactly one square, filled or not', () => {
    expect(arrowInCrossword(index, across(13), 'right')).toEqual(across(14));
    expect(arrowInCrossword(index, across(13), 'left')).toEqual(across(12));
    expect(arrowInCrossword(index, down(13), 'down')).toEqual(down(18));
  });

  it('steps over black squares, and stays at the edge of the grid', () => {
    // Row 1: cells 6-9, then the black square 10; nothing beyond it in the row.
    expect(arrowInCrossword(index, across(9), 'right')).toEqual(across(9));
    // Column 0: 1, 6, 11, then black 16 and 21.
    expect(arrowInCrossword(index, down(11), 'down')).toEqual(down(11));
    expect(arrowInCrossword(index, across(1), 'left')).toEqual(across(1));
  });

  it('steps over a black square to the next open one', () => {
    const result = crosswordFromFile({ grid: ['AB#CD', 'EF#GH'], clues: { across: [], down: [] } });
    if (!result.ok) throw new Error(result.error);
    const small = buildCrosswordIndex(result.crossword);
    expect(arrowInCrossword(small, across(2), 'right')).toEqual(across(4));
  });
});

describe('direction', () => {
  it('toggles, unless the square has no word the other way', () => {
    expect(toggleDirection(index, across(13))).toEqual(down(13));
    const result = crosswordFromFile({
      grid: ['ABC', '#D#', '#E#'],
      clues: { across: [], down: [] },
    });
    if (!result.ok) throw new Error(result.error);
    const small = buildCrosswordIndex(result.crossword);
    // Square 1 (A) is only in 1 Across.
    expect(toggleDirection(small, across(1))).toEqual(across(1));
    expect(currentWord(small, down(1))?.direction).toBe('across');
  });

  it('clicking the selected square switches direction; another square keeps it', () => {
    expect(clickSquare(index, across(13), 13)).toEqual(down(13));
    expect(clickSquare(index, across(13), 18)).toEqual(across(18));
  });

  it('clicking a square with no word in the current direction switches to the one it has', () => {
    const result = crosswordFromFile({
      grid: ['ABC', '#D#', '#E#'],
      clues: { across: [], down: [] },
    });
    if (!result.ok) throw new Error(result.error);
    const small = buildCrosswordIndex(result.crossword);
    expect(clickSquare(small, across(2), 5)).toEqual(down(5));
  });
});

describe('moving between clues', () => {
  it('starts on 1 Across', () => {
    expect(initialCrosswordSelection(index)).toEqual(across(1));
  });

  it('starts on any open square in a grid with no proper words', () => {
    const result = crosswordFromFile({ grid: ['#A', 'B#'], clues: { across: [], down: [] } });
    if (!result.ok) throw new Error(result.error);
    expect(initialCrosswordSelection(buildCrosswordIndex(result.crossword))).toEqual(across(2));
  });

  it('tabs through Across then Down, landing on the first empty square', () => {
    expect(tabOrder(index).map((w) => `${w.number}${w.direction[0]}`)).toEqual([
      '1a',
      '4a',
      '6a',
      '8a',
      '9a',
      '1d',
      '2d',
      '3d',
      '5d',
      '7d',
    ]);
    expect(jumpInCrossword(index, filled(6, 7), across(2), 1)).toEqual(across(8));
    expect(jumpInCrossword(index, emptySolveState, across(23), 1)).toEqual(down(1));
    expect(jumpInCrossword(index, emptySolveState, down(1), -1)).toEqual(across(23));
  });

  it('stays put past either end, and says when Tab would leave', () => {
    expect(jumpInCrossword(index, emptySolveState, across(1), -1)).toEqual(across(1));
    expect(jumpInCrossword(index, emptySolveState, down(25), 1)).toEqual(down(25));
    expect(atTabEnd(index, across(2), -1)).toBe(true);
    expect(atTabEnd(index, down(20), 1)).toBe(true);
    expect(atTabEnd(index, across(2), 1)).toBe(false);
  });

  it('entering a full word lands on its first square', () => {
    const word = index.wordNumbered('across', 1);
    if (!word) throw new Error('no 1 Across');
    expect(enterWord(filled(1, 2, 3), word)).toEqual(across(1));
  });
});
