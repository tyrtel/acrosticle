import { describe, expect, it } from 'vitest';
import { diploCrostic37, makePuzzle, tinyPuzzle } from '../tests/support/puzzles';
import type { Puzzle } from './puzzle';
import { hasErrors, validatePuzzle, type IssueCode, type ValidationIssue } from './validatePuzzle';

const codes = (issues: ValidationIssue[]) => issues.map((issue) => issue.code);
const only = (issues: ValidationIssue[], code: IssueCode) => issues.filter((i) => i.code === code);

describe('validatePuzzle', () => {
  describe('valid puzzles', () => {
    it('accepts the tiny puzzle', () => {
      expect(validatePuzzle(tinyPuzzle())).toEqual([]);
    });

    it('accepts the corrected sample puzzle', () => {
      expect(validatePuzzle(diploCrostic37())).toEqual([]);
    });
  });

  describe('the sample as printed (with its misprint)', () => {
    it('reports exactly the misprinted square, with a one-click fix', () => {
      const puzzle = diploCrostic37({ asPrinted: true });
      const issues = validatePuzzle(puzzle);

      expect(issues).toHaveLength(1);
      const [issue] = issues;
      expect(issue).toMatchObject({
        code: 'label-mismatch',
        severity: 'error',
        cells: [193],
        clues: ['Y', 'V'],
        message: 'Square 193 is labelled Y, but blank 193 is in clue V. Change the label to V?',
      });
      expect(issue?.fix).toMatchObject({ kind: 'relabel-square', label: 'V' });
      expect(puzzle.grid.squares[issue?.fix?.gridIndex ?? -1]).toEqual({
        kind: 'letter',
        number: 193,
        clue: 'Y',
      });
    });
  });

  describe('grid shape', () => {
    it('rejects a non-positive column count', () => {
      const puzzle: Puzzle = { ...tinyPuzzle(), grid: { ...tinyPuzzle().grid, columns: 0 } };
      expect(codes(validatePuzzle(puzzle))).toContain('invalid-columns');
    });

    it('rejects a grid with no letter squares', () => {
      const puzzle = makePuzzle(2, ['# #'], {});
      expect(codes(validatePuzzle(puzzle))).toContain('no-letter-squares');
    });
  });

  describe('square numbering (V1, V2)', () => {
    it('flags a misread digit as out of range, missing and out of sequence', () => {
      // Square 3 misread as 8.
      const puzzle = makePuzzle(4, ['1A 2B # 8A', '4B # 5A'], { A: [3, 1, 5], B: [4, 2] });
      const issues = validatePuzzle(puzzle);

      expect(only(issues, 'invalid-square-number')).toMatchObject([{ gridIndexes: [3] }]);
      expect(only(issues, 'missing-square-number')).toMatchObject([{ cells: [3] }]);
      expect(only(issues, 'square-number-sequence').map((i) => i.cells)).toEqual([[8], [4]]);
      expect(only(issues, 'square-number-sequence')[0]?.severity).toBe('warning');
    });

    it('flags duplicate numbers with every square involved', () => {
      const puzzle = makePuzzle(4, ['1A 2B # 2A', '4B # 5A'], { A: [3, 1, 5], B: [4, 2] });
      expect(only(validatePuzzle(puzzle), 'duplicate-square-number')).toMatchObject([
        { cells: [2], gridIndexes: [1, 3] },
      ]);
    });

    it('expects numbering to start at 1', () => {
      const puzzle = makePuzzle(2, ['2A 1A'], { A: [1, 2] });
      expect(only(validatePuzzle(puzzle), 'square-number-sequence')[0]?.cells).toEqual([2]);
    });
  });

  describe('clue labels (V5)', () => {
    it('flags a gap in the sequence once, at the first break', () => {
      const puzzle = makePuzzle(3, ['1A 2C 3D'], { A: [1], C: [2], D: [3] });
      const issues = only(validatePuzzle(puzzle), 'clue-label-sequence');
      expect(issues).toHaveLength(1);
      expect(issues[0]).toMatchObject({ clues: ['C'] });
      expect(issues[0]?.message).toContain('but B was expected');
    });

    it('flags duplicate labels once each', () => {
      const puzzle: Puzzle = {
        ...tinyPuzzle(),
        clues: [
          { label: 'A', text: 'x', cells: [3, 1, 5] },
          { label: 'A', text: 'y', cells: [4, 2] },
          { label: 'A', text: 'z', cells: [] },
        ],
      };
      const issues = validatePuzzle(puzzle);
      expect(only(issues, 'duplicate-clue-label')).toHaveLength(1);
      expect(codes(issues)).not.toContain('clue-label-sequence');
    });
  });

  describe('clue contents (V7)', () => {
    it('flags empty text, missing blanks and repeated blanks', () => {
      const puzzle: Puzzle = {
        ...tinyPuzzle(),
        clues: [
          { label: 'A', text: '  ', cells: [3, 1, 5, 1] },
          { label: 'B', text: 'ok', cells: [] },
        ],
      };
      const issues = validatePuzzle(puzzle);
      expect(only(issues, 'empty-clue-text')).toMatchObject([{ clues: ['A'] }]);
      expect(only(issues, 'clue-without-cells')).toMatchObject([{ clues: ['B'] }]);
      expect(only(issues, 'cell-repeated-in-clue')).toMatchObject([{ clues: ['A'], cells: [1] }]);
    });
  });

  describe('cell coverage (V3)', () => {
    it('flags a blank listed in two clues', () => {
      const puzzle = makePuzzle(4, ['1A 2B # 3A', '4B # 5A'], { A: [3, 1, 5], B: [4, 2, 5] });
      expect(only(validatePuzzle(puzzle), 'cell-in-multiple-clues')).toMatchObject([
        { cells: [5], clues: ['A', 'B'] },
      ]);
    });

    it('flags a blank with no grid square, and a square in no clue', () => {
      // Clue B lists 9 instead of 2 (a misread blank number).
      const puzzle = makePuzzle(4, ['1A 2B # 3A', '4B # 5A'], { A: [3, 1, 5], B: [4, 9] });
      const issues = validatePuzzle(puzzle);
      expect(only(issues, 'cell-not-in-grid')).toMatchObject([{ clues: ['B'], cells: [9] }]);
      expect(only(issues, 'cell-not-in-any-clue')).toMatchObject([
        { cells: [2], gridIndexes: [1] },
      ]);
    });
  });

  describe('square labels (V4)', () => {
    it('suggests relabelling a square to its owning clue', () => {
      const puzzle = makePuzzle(4, ['1A 2A # 3A', '4B # 5A'], { A: [3, 1, 5], B: [4, 2] });
      expect(only(validatePuzzle(puzzle), 'label-mismatch')).toMatchObject([
        { cells: [2], fix: { kind: 'relabel-square', gridIndex: 1, label: 'B' } },
      ]);
    });

    it('flags a label naming a clue that does not exist', () => {
      const puzzle = makePuzzle(4, ['1A 2Q # 3A', '4B # 5A'], { A: [3, 1, 5], B: [4] });
      expect(only(validatePuzzle(puzzle), 'unknown-clue-label')).toMatchObject([{ cells: [2] }]);
    });

    it('does not guess a label when the blank is in several clues', () => {
      const puzzle = makePuzzle(4, ['1A 2A # 3A', '4B # 5A'], { A: [3, 1, 5, 2], B: [4, 2] });
      expect(codes(validatePuzzle(puzzle))).not.toContain('label-mismatch');
    });
  });

  describe('block layout (V8)', () => {
    it('reports leading, trailing and adjacent blocks as info', () => {
      const puzzle = makePuzzle(4, ['# 1A # #', '2A #'], { A: [1, 2] });
      const issues = validatePuzzle(puzzle);
      expect(codes(issues)).toEqual(['leading-block', 'trailing-block', 'adjacent-blocks']);
      expect(issues.every((i) => i.severity === 'info')).toBe(true);
      expect(hasErrors(issues)).toBe(false);
    });
  });
});

describe('hasErrors', () => {
  it('is true only when an issue has error severity', () => {
    const warning: ValidationIssue = {
      code: 'square-number-sequence',
      severity: 'warning',
      message: '',
    };
    const error: ValidationIssue = {
      code: 'missing-square-number',
      severity: 'error',
      message: '',
    };
    expect(hasErrors([])).toBe(false);
    expect(hasErrors([warning])).toBe(false);
    expect(hasErrors([warning, error])).toBe(true);
  });
});
