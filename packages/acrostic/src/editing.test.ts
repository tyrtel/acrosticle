import { describe, expect, it } from 'vitest';
import { diploCrostic37, makePuzzle, tinyPuzzle } from '../tests/support/puzzles';
import { puzzleFromCompact } from './compactGrid';
import { applyFix, formatCompactGrid, puzzleToCompact, replaceSquare, updateClue } from './editing';
import { validatePuzzle } from './validatePuzzle';

describe('replaceSquare', () => {
  it('replaces one square without mutating the original', () => {
    const puzzle = tinyPuzzle();
    const next = replaceSquare(puzzle, 2, { kind: 'letter', number: 9, clue: 'A' });
    expect(next.grid.squares[2]).toEqual({ kind: 'letter', number: 9, clue: 'A' });
    expect(puzzle.grid.squares[2]).toEqual({ kind: 'block' });
  });

  it.each([-1, 7, 1.5])('rejects grid index %s', (gridIndex) => {
    expect(() => replaceSquare(tinyPuzzle(), gridIndex, { kind: 'block' })).toThrow(RangeError);
  });
});

describe('updateClue', () => {
  it('changes text and blanks of one clue', () => {
    const next = updateClue(tinyPuzzle(), 'B', { text: 'New', cells: [2, 4] });
    expect(next.clues[1]).toEqual({ label: 'B', text: 'New', cells: [2, 4] });
    expect(next.clues[0]).toEqual(tinyPuzzle().clues[0]);
  });

  it('rejects an unknown clue', () => {
    expect(() => updateClue(tinyPuzzle(), 'Z', { text: 'x' })).toThrow('Unknown clue: Z');
  });
});

describe('applyFix', () => {
  it('fixes the misprint in the sample puzzle', () => {
    const printed = diploCrostic37({ asPrinted: true });
    const [issue] = validatePuzzle(printed);
    if (!issue?.fix) throw new Error('expected a fix');
    expect(validatePuzzle(applyFix(printed, issue.fix))).toEqual([]);
  });

  it('rejects a fix that targets a non-letter square', () => {
    expect(() =>
      applyFix(tinyPuzzle(), { kind: 'relabel-square', gridIndex: 2, label: 'A' }),
    ).toThrow(RangeError);
  });
});

describe('formatCompactGrid / puzzleToCompact', () => {
  it('writes rows, including a short last row and punctuation', () => {
    const puzzle = makePuzzle(3, ["1A # '", '2A'], { A: [1, 2] });
    expect(formatCompactGrid(puzzle.grid)).toEqual(["1A # '", '2A']);
  });

  it('round-trips the sample puzzle', () => {
    const sample = diploCrostic37();
    const roundTripped = puzzleFromCompact(puzzleToCompact(sample));
    expect(roundTripped).toEqual({ ok: true, puzzle: sample });
  });

  it('omits missing metadata', () => {
    expect(Object.keys(puzzleToCompact(tinyPuzzle()))).toEqual(['grid', 'clues']);
  });
});
