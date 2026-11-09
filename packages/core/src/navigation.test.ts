import { describe, expect, it } from 'vitest';
import { letter, makePuzzle, tinyPuzzle } from '../tests/support/puzzles';
import {
  acrosticLetters,
  describeSelection,
  enterLetter,
  erase,
  jumpToClue,
  moveInGrid,
  step,
  type Selection,
} from './navigation';
import { buildPuzzleIndex } from './puzzleIndex';
import { emptySolveState, setCell } from './solveState';

//   1A 2B  #  3A
//   4B  #  5A
// Clue A = 3, 1, 5. Clue B = 4, 2.
const index = buildPuzzleIndex(tinyPuzzle());
const inGrid = (cell: number): Selection => ({ cell, view: 'grid' });
const inClue = (cell: number): Selection => ({ cell, view: 'clue' });

describe('describeSelection', () => {
  it('returns the clue, position, clue cells and grid word to highlight', () => {
    expect(describeSelection(index, inGrid(1))).toEqual({
      cell: 1,
      clue: 'A',
      position: 1,
      clueCells: [3, 1, 5],
      wordCells: [1, 2],
    });
  });
});

describe('step', () => {
  it('follows reading order in the grid', () => {
    expect(step(index, inGrid(2), 1)).toEqual(inGrid(3));
    expect(step(index, inGrid(3), -1)).toEqual(inGrid(2));
  });

  it('follows answer order in a clue', () => {
    expect(step(index, inClue(3), 1)).toEqual(inClue(1));
    expect(step(index, inClue(1), 1)).toEqual(inClue(5));
  });

  it('stops at the ends', () => {
    expect(step(index, inGrid(5), 1)).toEqual(inGrid(5));
    expect(step(index, inGrid(1), -1)).toEqual(inGrid(1));
    expect(step(index, inClue(5), 1)).toEqual(inClue(5));
  });
});

describe('moveInGrid', () => {
  // 3 columns:   1A  #  2A
  //              3A 4A  #
  //               #  5A 6A
  const grid = buildPuzzleIndex(
    makePuzzle(3, ['1A # 2A', '3A 4A #', '# 5A 6A'], { A: [1, 2, 3, 4, 5, 6] }),
  );

  it('moves left and right in reading order, wrapping rows', () => {
    expect(moveInGrid(grid, inGrid(2), 'right')).toEqual(inGrid(3));
    expect(moveInGrid(grid, inGrid(3), 'left')).toEqual(inGrid(2));
  });

  it('moves up and down by column', () => {
    expect(moveInGrid(grid, inGrid(1), 'down')).toEqual(inGrid(3));
    expect(moveInGrid(grid, inGrid(5), 'up')).toEqual(inGrid(4));
  });

  it('skips black squares when moving vertically', () => {
    expect(moveInGrid(grid, inGrid(2), 'down')).toEqual(inGrid(6));
  });

  it('stays put at the edge, switching to the grid view', () => {
    expect(moveInGrid(grid, inClue(1), 'up')).toEqual(inGrid(1));
    expect(moveInGrid(grid, inGrid(3), 'down')).toEqual(inGrid(3));
  });
});

describe('jumpToClue', () => {
  it('lands on the first empty blank of the next clue', () => {
    const state = setCell(emptySolveState, 4, letter('X'));
    expect(jumpToClue(index, state, inGrid(1), 1)).toEqual(inClue(2));
  });

  it('lands on the first blank when the clue is full', () => {
    let state = setCell(emptySolveState, 4, letter('X'));
    state = setCell(state, 2, letter('Y'));
    expect(jumpToClue(index, state, inGrid(1), 1)).toEqual(inClue(4));
  });

  it('wraps around in both directions', () => {
    expect(jumpToClue(index, emptySolveState, inClue(4), 1)).toEqual(inClue(3));
    expect(jumpToClue(index, emptySolveState, inClue(3), -1)).toEqual(inClue(4));
  });
});

describe('enterLetter', () => {
  it('fills the cell and advances within the active view', () => {
    const fromGrid = enterLetter(index, inGrid(1), letter('Q'));
    expect(fromGrid.edit).toEqual({ cell: 1, value: 'Q' });
    expect(fromGrid.selection).toEqual(inGrid(2));

    const fromClue = enterLetter(index, inClue(1), letter('Q'));
    expect(fromClue.selection).toEqual(inClue(5));
  });
});

describe('erase', () => {
  it('clears a filled cell and stays put', () => {
    const state = setCell(emptySolveState, 2, letter('B'));
    const result = erase(index, state, inGrid(2));
    expect(result.edit).toEqual({ cell: 2, value: null });
    expect(result.selection).toEqual(inGrid(2));
  });

  it('on an empty cell, moves back and clears the previous cell', () => {
    const state = setCell(emptySolveState, 3, letter('C'));
    const result = erase(index, state, inClue(1));
    expect(result.edit).toEqual({ cell: 3, value: null });
    expect(result.selection).toEqual(inClue(3));
  });

  it('moves back without an edit when the previous cell is already empty', () => {
    const result = erase(index, emptySolveState, inGrid(2));
    expect(result.edit).toBeNull();
    expect(result.selection).toEqual(inGrid(1));
  });

  it('does nothing at the start of an empty run', () => {
    const result = erase(index, emptySolveState, inGrid(1));
    expect(result.edit).toBeNull();
    expect(result.selection).toEqual(inGrid(1));
  });
});

describe('acrosticLetters', () => {
  it("returns each clue's first letter, or null if empty", () => {
    const state = setCell(emptySolveState, 3, letter('D'));
    expect(acrosticLetters(index, state)).toEqual(['D', null]);
  });
});
