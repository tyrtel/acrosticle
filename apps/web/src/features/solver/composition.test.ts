import {
  applyEdit,
  buildPuzzleIndex,
  emptySolveState,
  normalizeEntry,
  parseCompactGrid,
  setCell,
  type Entry,
  type Puzzle,
  type SolveState,
} from '@acrosticle/core';
import { describe, expect, it } from 'vitest';
import { startComposition, syncComposition, type Composition } from './composition';

//   1A 2B  #  3A
//   4B  #  5A
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
const entry = (s: string): Entry => normalizeEntry(s) ?? (s as never);

/** Feeds successive composing texts, applying each sync's edits like the room would. */
function compose(texts: readonly string[], solve: SolveState = emptySolveState) {
  let composition: Composition = startComposition({ cell: 1, view: 'grid' });
  let state = solve;
  let result = syncComposition(index, state, composition, '');
  for (const text of texts) {
    result = syncComposition(index, state, composition, text);
    state = result.edits.reduce(applyEdit, state);
    composition = result.composition;
  }
  return { state, result };
}

describe('syncComposition', () => {
  it('types each letter as a growing word is composed', () => {
    const { state, result } = compose(['h', 'hi']);
    expect(state).toEqual({ 1: 'h', 2: 'i' });
    expect(result.edits).toEqual([{ cell: 2, value: 'i' }]);
    expect(result.selection).toEqual({ cell: 3, view: 'grid' });
  });

  it('takes letters back when the composing text shrinks (Backspace while composing)', () => {
    const { state, result } = compose(['h', 'hi', 'h']);
    expect(state).toEqual({ 1: 'h' });
    expect(result.selection).toEqual({ cell: 2, view: 'grid' });
  });

  it('replaces letters an IME converts', () => {
    const { state } = compose(['k', 'か']);
    expect(state).toEqual({ 1: 'か' });
  });

  it('puts back what a taken-back letter overwrote', () => {
    const { state } = compose(['ab', 'a'], setCell(emptySolveState, 2, entry('Z')));
    expect(state).toEqual({ 1: 'a', 2: 'Z' });
  });

  it('changes nothing when the text is unchanged', () => {
    const first = compose(['ab']);
    const again = syncComposition(index, first.state, first.result.composition, 'ab');
    expect(again.edits).toEqual([]);
    expect(again.selection).toEqual({ cell: 3, view: 'grid' });
  });

  it('skips characters that cannot go in a square', () => {
    const { state } = compose(['a b']);
    expect(state).toEqual({ 1: 'a', 2: 'b' });
  });
});
