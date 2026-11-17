import { describe, expect, it } from 'vitest';
import { buildCrosswordIndex } from './crosswordIndex';
import { blankCrossword } from './editing';
import type { Crossword } from './puzzle';
import { reconcileWithClues } from './reconcile';
import { solveBarredLayout, type Enumerated } from './solveBarred';

/** A 5×5 barred grid with unchecked squares, as a setter might make it. */
const truth: Crossword = {
  ...blankCrossword(5, 5),
  bars: { right: [2, 9, 13, 17, 23], bottom: [3, 6, 10, 14, 17, 19] },
};
const index = buildCrosswordIndex(truth);
const answers: Enumerated[] = (['across', 'down'] as const).flatMap((direction) =>
  index.words(direction).map((w) => ({ number: w.number, direction, length: w.cells.length })),
);
const wordsOf = (bars: Crossword['bars']) => {
  const solved = buildCrosswordIndex({ ...truth, bars });
  return (['across', 'down'] as const).map((d) =>
    solved.words(d).map((w) => `${w.number}:${w.cells.join(',')}`),
  );
};

describe('solveBarredLayout', () => {
  it('recovers a layout from the clue numbers and lengths alone', () => {
    const bars = solveBarredLayout(5, 5, answers);
    expect(bars).not.toBeNull();
    // Same answers in the same squares (bars may be drawn differently where it doesn't matter).
    expect(wordsOf(bars ?? undefined)).toEqual(wordsOf(truth.bars));
  });

  it('follows the guide where the clues allow more than one layout', () => {
    // Answer 6 (four across) fits at square 6 or 7; a reader who saw "6" in square 7 gets that.
    const guide = [{ number: 6, row: 2, column: 2 }];
    expect(wordsOf(solveBarredLayout(5, 5, answers, guide) ?? undefined)[0]).toContain(
      '6:7,8,9,10',
    );
  });

  it('never contradicts the clues, however wrong the guide', () => {
    const wrongGuide = answers.map((a, i) => ({ number: a.number, row: 1 + (i % 5), column: 5 }));
    const bars = solveBarredLayout(5, 5, answers, wrongGuide);
    const solved = buildCrosswordIndex({ ...truth, bars: bars ?? undefined });
    for (const a of answers) {
      expect(solved.wordNumbered(a.direction, a.number)?.cells).toHaveLength(a.length);
    }
  });

  it('says when no layout fits', () => {
    expect(solveBarredLayout(3, 3, [{ number: 1, direction: 'across', length: 9 }])).toBeNull();
  });
});

describe('reconcileWithClues on a barred grid', () => {
  it('replaces misread bars with the layout the clues fix', () => {
    const clues = {
      across: index
        .words('across')
        .map((w) => ({ number: w.number, text: `x (${w.cells.length})` })),
      down: index.words('down').map((w) => ({ number: w.number, text: `y (${w.cells.length})` })),
    };
    const misread: Crossword = { ...truth, clues, bars: { right: [1], bottom: [] } };
    const { crossword, notes } = reconcileWithClues(misread, []);
    expect(wordsOf(crossword.bars)).toEqual(wordsOf(truth.bars));
    expect(notes).toEqual([
      'Laid out the bars from the clue numbers and answer lengths; check them against the photo.',
    ]);
  });
});
