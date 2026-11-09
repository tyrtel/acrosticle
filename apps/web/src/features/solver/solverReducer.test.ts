import {
  buildPuzzleIndex,
  emptySolveState,
  getCell,
  normalizeLetter,
  parseCompactGrid,
  type Letter,
  type Puzzle,
} from '@acrosticle/core';
import { describe, expect, it } from 'vitest';
import { initialSolverState, reduceSolver, type SolverState } from './solverReducer';

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
const start = initialSolverState(index, emptySolveState);
const at = (cell: number, view: 'grid' | 'clue' = 'grid'): SolverState => ({
  ...start,
  selection: { cell, view },
});

describe('initialSolverState', () => {
  it('selects the first grid square', () => {
    expect(start.selection).toEqual({ cell: 1, view: 'grid' });
  });

  it('throws for a puzzle with no letter squares', () => {
    expect(() => initialSolverState({ ...index, cells: [] }, emptySolveState)).toThrow();
  });
});

describe('reduceSolver', () => {
  it('selects a cell in a view', () => {
    const next = reduceSolver(index, start, { type: 'select', cell: 5, view: 'clue' });
    expect(next.selection).toEqual({ cell: 5, view: 'clue' });
  });

  it('types and advances', () => {
    const next = reduceSolver(index, start, { type: 'input', letter: L('X') });
    expect(getCell(next.solve, 1)).toBe('X');
    expect(next.selection.cell).toBe(2);
  });

  it('erases backwards and clears in place', () => {
    const typed = reduceSolver(index, start, { type: 'input', letter: L('X') });
    const erased = reduceSolver(index, typed, { type: 'erase' });
    expect(getCell(erased.solve, 1)).toBeNull();
    expect(erased.selection.cell).toBe(1);

    const cleared = reduceSolver(
      index,
      { ...typed, selection: { cell: 1, view: 'grid' } },
      {
        type: 'clear',
      },
    );
    expect(getCell(cleared.solve, 1)).toBeNull();
    expect(cleared.selection.cell).toBe(1);
  });

  it('moves, steps and jumps between clues', () => {
    expect(reduceSolver(index, at(1), { type: 'move', direction: 'down' }).selection.cell).toBe(4);
    expect(reduceSolver(index, at(3, 'clue'), { type: 'step', delta: 1 }).selection.cell).toBe(1);
    expect(reduceSolver(index, at(1), { type: 'jumpClue', delta: 1 }).selection).toEqual({
      cell: 4,
      view: 'clue',
    });
  });

  it('toggles between views, keeping the cell', () => {
    const toClue = reduceSolver(index, at(2), { type: 'toggleView' });
    expect(toClue.selection).toEqual({ cell: 2, view: 'clue' });
    expect(reduceSolver(index, toClue, { type: 'toggleView' }).selection.view).toBe('grid');
  });
});
