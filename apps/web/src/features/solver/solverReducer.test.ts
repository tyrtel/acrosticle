import {
  buildPuzzleIndex,
  emptySolveState,
  normalizeLetter,
  parseCompactGrid,
  setCell,
  type Letter,
  type Puzzle,
  type Selection,
} from '@acrosticle/core';
import { describe, expect, it } from 'vitest';
import { initialSelection, reduceSolver } from './solverReducer';

//   1A 2B  #  3A
//   4B  #  5A
// Clue A = 3, 1, 5. Clue B = 4, 2.
function tinyPuzzle(): Puzzle {
  const grid = parseCompactGrid(4, ['1A 2B # 3A', '4B # 5A']);
  if (!grid.ok) throw new Error(grid.error);
  return {
    grid: grid.grid,
    clues: [
      { label: 'A', text: 'First', cells: [3, 1, 5] },
      { label: 'B', text: 'Second', cells: [4, 2] },
    ],
  };
}

const index = buildPuzzleIndex(tinyPuzzle());
const L = (s: string): Letter => normalizeLetter(s) ?? (s as never);
const at = (cell: number, view: 'grid' | 'clue' = 'grid'): Selection => ({ cell, view });
const run = (
  selection: Selection,
  action: Parameters<typeof reduceSolver>[3],
  solve = emptySolveState,
) => reduceSolver(index, solve, selection, action);

describe('initialSelection', () => {
  it('selects the first grid square', () => {
    expect(initialSelection(index)).toEqual(at(1));
  });

  it('throws for a puzzle with no letter squares', () => {
    expect(() => initialSelection({ ...index, cells: [] })).toThrow();
  });
});

describe('reduceSolver', () => {
  it('selects a cell in a view, with no edit', () => {
    expect(run(at(1), { type: 'select', cell: 5, view: 'clue' })).toEqual({
      selection: at(5, 'clue'),
      edit: null,
    });
  });

  it('types: an edit for the cell, and the cursor advances', () => {
    expect(run(at(1), { type: 'input', letter: L('X') })).toEqual({
      selection: at(2),
      edit: { cell: 1, value: 'X' },
    });
  });

  it('erases backwards, and clears in place', () => {
    const solve = setCell(emptySolveState, 1, L('X'));
    expect(run(at(2), { type: 'erase' }, solve)).toEqual({
      selection: at(1),
      edit: { cell: 1, value: null },
    });
    expect(run(at(1), { type: 'clear' }, solve)).toEqual({
      selection: at(1),
      edit: { cell: 1, value: null },
    });
  });

  it('moves, steps and jumps between clues without editing', () => {
    expect(run(at(1), { type: 'move', direction: 'down' })).toEqual({
      selection: at(4),
      edit: null,
    });
    expect(run(at(3, 'clue'), { type: 'step', delta: 1 }).selection).toEqual(at(1, 'clue'));
    expect(run(at(1), { type: 'jumpClue', delta: 1 }).selection).toEqual(at(4, 'clue'));
  });

  it('toggles between views, keeping the cell', () => {
    const toClue = run(at(2), { type: 'toggleView' }).selection;
    expect(toClue).toEqual(at(2, 'clue'));
    expect(run(toClue, { type: 'toggleView' }).selection).toEqual(at(2));
  });
});
