import type { CrosswordIndex } from './crosswordIndex';
import type { Direction } from './puzzle';
import { printedLength } from './reconcile';

export type CrosswordIssueCode =
  | 'no-squares'
  | 'no-words'
  | 'length-mismatch'
  | 'missing-clue'
  | 'extra-clue'
  | 'duplicate-clue'
  | 'empty-clue';

export interface CrosswordIssue {
  /** Errors stop a room being created; warnings are worth a look but solvable. */
  readonly severity: 'error' | 'warning';
  readonly code: CrosswordIssueCode;
  readonly message: string;
}

/**
 * Checks a crossword against its own grid. Only a grid with no open squares is
 * an error (there's nothing to type in). Everything else is a warning: a
 * stylized puzzle may break the usual rules on purpose, so solvers can still
 * start and work out the trick.
 */
export function validateCrossword(index: CrosswordIndex): CrosswordIssue[] {
  if (index.cells.length === 0) {
    return [{ severity: 'error', code: 'no-squares', message: 'The grid has no open squares.' }];
  }
  const noWords =
    index.words('across').length + index.words('down').length === 0
      ? [warning('no-words', 'The grid has no words of two or more squares.')]
      : [];
  return [...noWords, ...(['across', 'down'] as const).flatMap((d) => checkClues(index, d))];
}

export function hasCrosswordErrors(issues: readonly CrosswordIssue[]): boolean {
  return issues.some((issue) => issue.severity === 'error');
}

function checkClues(index: CrosswordIndex, direction: Direction): CrosswordIssue[] {
  const issues: CrosswordIssue[] = [];
  const name = direction === 'across' ? 'Across' : 'Down';
  const seen = new Set<number>();
  for (const clue of index.puzzle.clues[direction]) {
    if (seen.has(clue.number)) {
      issues.push(warning('duplicate-clue', `${clue.number} ${name} has more than one clue.`));
    }
    seen.add(clue.number);
    if (!index.wordNumbered(direction, clue.number)) {
      issues.push(
        warning(
          'extra-clue',
          `There's a clue for ${clue.number} ${name}, but no such word in the grid.`,
        ),
      );
    } else if (clue.text.trim() === '') {
      issues.push(warning('empty-clue', `The clue for ${clue.number} ${name} is blank.`));
    } else if (index.puzzle.style !== 'rows-columns') {
      // (Rows and columns hold several clues each, so a printed length can't be checked.)
      const printed = printedLength(clue.text);
      const actual = index.wordNumbered(direction, clue.number)?.cells.length;
      if (printed !== null && actual !== undefined && printed !== actual) {
        issues.push(
          warning(
            'length-mismatch',
            `The clue for ${clue.number} ${name} says ${printed} letters, but the grid has ${actual}.`,
          ),
        );
      }
    }
  }
  for (const word of index.words(direction)) {
    if (!seen.has(word.number)) {
      issues.push(warning('missing-clue', `${word.number} ${name} has no clue.`));
    }
  }
  return issues;
}

function warning(code: CrosswordIssueCode, message: string): CrosswordIssue {
  return { severity: 'warning', code, message };
}
