import { describe, expect, it } from 'vitest';
import { mini } from '../tests/support/mini';
import { buildCrosswordIndex } from './crosswordIndex';
import { crosswordFromFile } from './file';
import { hasCrosswordErrors, validateCrossword } from './validateCrossword';

describe('validateCrossword', () => {
  it('passes the sample', () => {
    expect(validateCrossword(buildCrosswordIndex(mini()))).toEqual([]);
  });

  it('only rejects a grid with no open squares', () => {
    const result = crosswordFromFile({ grid: ['##', '##'], clues: { across: [], down: [] } });
    if (!result.ok) throw new Error(result.error);
    const issues = validateCrossword(buildCrosswordIndex(result.crossword));
    expect(issues.map((i) => i.code)).toEqual(['no-squares']);
    expect(hasCrosswordErrors(issues)).toBe(true);
  });

  it('only warns about a grid with no proper words (it may be a stylized puzzle)', () => {
    const result = crosswordFromFile({ grid: ['A#', '#B'], clues: { across: [], down: [] } });
    if (!result.ok) throw new Error(result.error);
    const issues = validateCrossword(buildCrosswordIndex(result.crossword));
    expect(issues.map((i) => i.code)).toEqual(['no-words']);
    expect(hasCrosswordErrors(issues)).toBe(false);
  });

  it('warns when a printed answer length does not match the grid', () => {
    const puzzle = mini();
    const clues = {
      across: puzzle.clues.across.map((c) =>
        c.number === 1
          ? { ...c, text: 'Fuel (4)' }
          : c.number === 6
            ? { ...c, text: 'Stone (2,3)' }
            : c,
      ),
      down: puzzle.clues.down,
    };
    const issues = validateCrossword(buildCrosswordIndex({ ...puzzle, clues }));
    expect(issues.map((i) => i.message)).toEqual([
      'The clue for 1 Across says 4 letters, but the grid has 3.',
    ]);
  });

  it('warns about missing, extra, duplicate and blank clues', () => {
    const puzzle = mini();
    const issues = validateCrossword(
      buildCrosswordIndex({
        ...puzzle,
        clues: {
          across: [
            ...puzzle.clues.across.filter((c) => c.number !== 4),
            { number: 2, text: 'No such word' },
            { number: 1, text: 'Again' },
          ],
          down: puzzle.clues.down.map((c) => (c.number === 5 ? { ...c, text: ' ' } : c)),
        },
      }),
    );
    expect(issues.map((i) => [i.code, i.message])).toEqual([
      ['extra-clue', "There's a clue for 2 Across, but no such word in the grid."],
      ['duplicate-clue', '1 Across has more than one clue.'],
      ['missing-clue', '4 Across has no clue.'],
      ['empty-clue', 'The clue for 5 Down is blank.'],
    ]);
    expect(hasCrosswordErrors(issues)).toBe(false);
  });
});
