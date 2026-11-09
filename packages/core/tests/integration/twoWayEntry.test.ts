import { describe, expect, it } from 'vitest';
import {
  acrosticLetters,
  buildPuzzleIndex,
  emptySolveState,
  enterLetter,
  getCell,
  type Selection,
  type SolveState,
} from '../../src';
import { diploCrostic37, letter } from '../support/puzzles';

const index = buildPuzzleIndex(diploCrostic37());

/** Types a word starting at `start`, the way a solver would. */
function type(state: SolveState, start: Selection, word: string) {
  let result = { state, selection: start };
  for (const ch of word) {
    result = enterLetter(index, result.state, result.selection, letter(ch));
  }
  return result;
}

describe('two-way entry on the sample puzzle', () => {
  it('typing a clue answer fills the matching grid squares', () => {
    // Clue A, "Daughter to Brabantio": blanks 138 5 44 232 224 50 171 26 152.
    const { state } = type(emptySolveState, { cell: 138, view: 'clue' }, 'DESDEMONA');

    const gridLetters = [138, 5, 44, 232, 224, 50, 171, 26, 152].map((c) => getCell(state, c));
    expect(gridLetters.join('')).toBe('DESDEMONA');
    // Grid square 5 sits in the first grid row, far from clue A's list.
    expect(index.gridIndexOf(5)).toBe(4);
    expect(getCell(state, 5)).toBe('E');
  });

  it('typing in the grid fills the matching clue blanks', () => {
    // Grid row 1 starts "1O 2E 3P 4D 5A ...": type across the first five squares.
    const { state, selection } = type(emptySolveState, { cell: 1, view: 'grid' }, 'ABCDE');
    expect(selection).toEqual({ cell: 6, view: 'grid' });

    // Square 5 is clue A's second blank; square 2 is clue E's fourth blank.
    const clueA = index.clue('A').cells.map((c) => getCell(state, c));
    expect(clueA[1]).toBe('E');
    const clueE = index.clue('E').cells.map((c) => getCell(state, c));
    expect(clueE[3]).toBe('B');
  });

  it('spells the acrostic from the first letter of each answer', () => {
    // The first letters spell DAVID HALBERSTAM, THE AMATEURS.
    const firstLetters = 'DAVIDHALBERSTAMTHEAMATEURS';
    let state = emptySolveState;
    index.clues.forEach((clue, i) => {
      const first = clue.cells[0];
      const ch = firstLetters[i];
      if (first !== undefined && ch !== undefined) {
        state = enterLetter(index, state, { cell: first, view: 'clue' }, letter(ch)).state;
      }
    });
    expect(acrosticLetters(index, state).join('')).toBe(firstLetters);
  });
});
