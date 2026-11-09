import { describe, expect, it } from 'vitest';
import { normalizeLetter, type Letter } from './letters';
import { applyEdit, emptySolveState, filledCount, getCell, setCell } from './solveState';

const L = (s: string): Letter => {
  const letter = normalizeLetter(s);
  if (!letter) throw new Error(`bad test letter ${s}`);
  return letter;
};

describe('setCell', () => {
  it('sets a letter without mutating the original state', () => {
    const next = setCell(emptySolveState, 3, L('A'));
    expect(getCell(next, 3)).toBe('A');
    expect(getCell(emptySolveState, 3)).toBeNull();
  });

  it('overwrites an existing letter', () => {
    const state = setCell(emptySolveState, 1, L('A'));
    expect(getCell(setCell(state, 1, L('B')), 1)).toBe('B');
  });

  it('clears a cell when value is null', () => {
    const state = setCell(emptySolveState, 1, L('A'));
    const cleared = setCell(state, 1, null);
    expect(getCell(cleared, 1)).toBeNull();
    expect(filledCount(cleared)).toBe(0);
  });

  it('returns the same reference when nothing changes', () => {
    const state = setCell(emptySolveState, 1, L('A'));
    expect(setCell(state, 1, L('A'))).toBe(state);
    expect(setCell(state, 2, null)).toBe(state);
  });

  it.each([0, -1, 2.5])('rejects invalid cell number %s', (cell) => {
    expect(() => setCell(emptySolveState, cell, L('A'))).toThrow(RangeError);
  });
});

describe('filledCount', () => {
  it('counts filled cells', () => {
    let state = emptySolveState;
    state = setCell(state, 1, L('A'));
    state = setCell(state, 5, L('B'));
    expect(filledCount(state)).toBe(2);
  });
});

describe('applyEdit', () => {
  it('applies a letter or a clear, and ignores null', () => {
    const filled = applyEdit(emptySolveState, { cell: 4, value: L('Z') });
    expect(getCell(filled, 4)).toBe('Z');
    expect(getCell(applyEdit(filled, { cell: 4, value: null }), 4)).toBeNull();
    expect(applyEdit(filled, null)).toBe(filled);
  });
});
