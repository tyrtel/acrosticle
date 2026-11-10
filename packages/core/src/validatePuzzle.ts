import { clueLabel } from './clueLabel';
import type { CellNumber, ClueLabel, Puzzle } from './puzzle';

export type IssueSeverity = 'error' | 'warning' | 'info';

export type IssueCode =
  | 'invalid-columns'
  | 'no-letter-squares'
  | 'invalid-square-number'
  | 'duplicate-square-number'
  | 'missing-square-number'
  | 'square-number-sequence'
  | 'duplicate-clue-label'
  | 'clue-label-sequence'
  | 'empty-clue-text'
  | 'clue-without-cells'
  | 'cell-repeated-in-clue'
  | 'cell-in-multiple-clues'
  | 'cell-not-in-grid'
  | 'cell-not-in-any-clue'
  | 'label-mismatch'
  | 'unknown-clue-label'
  | 'leading-block'
  | 'trailing-block'
  | 'adjacent-blocks';

/** A one-click correction the review UI can offer. */
export interface SuggestedFix {
  readonly kind: 'relabel-square';
  readonly gridIndex: number;
  readonly label: ClueLabel;
}

export interface ValidationIssue {
  readonly code: IssueCode;
  readonly severity: IssueSeverity;
  readonly message: string;
  /** Positions in `grid.squares` to highlight. */
  readonly gridIndexes?: readonly number[];
  readonly cells?: readonly CellNumber[];
  readonly clues?: readonly ClueLabel[];
  readonly fix?: SuggestedFix;
}

/**
 * Checks a puzzle for internal consistency using the redundancy built into
 * acrostics (grid labels vs. clue blanks, numbering 1..N). Works on drafts,
 * so it never throws: every problem becomes an issue. Issues are grouped by
 * rule, in a stable order.
 */
export function validatePuzzle(puzzle: Puzzle): ValidationIssue[] {
  const ctx = analyze(puzzle);
  return [
    ...checkGridShape(puzzle, ctx),
    ...checkSquareNumbers(ctx),
    ...checkClueLabels(puzzle),
    ...checkClueContents(puzzle),
    ...checkCellCoverage(puzzle, ctx),
    ...checkSquareLabels(ctx),
    ...checkBlockLayout(puzzle),
  ];
}

export function hasErrors(issues: readonly ValidationIssue[]): boolean {
  return issues.some((issue) => issue.severity === 'error');
}

interface LetterSquare {
  readonly gridIndex: number;
  readonly number: CellNumber;
  readonly clue: ClueLabel;
}

interface Analysis {
  readonly letters: readonly LetterSquare[];
  /** For each cell number, the labels of the clues whose blanks contain it. */
  readonly owners: ReadonlyMap<CellNumber, readonly ClueLabel[]>;
  readonly clueLabels: ReadonlySet<ClueLabel>;
}

function analyze(puzzle: Puzzle): Analysis {
  const letters: LetterSquare[] = [];
  puzzle.grid.squares.forEach((square, gridIndex) => {
    if (square.kind === 'letter') {
      letters.push({ gridIndex, number: square.number, clue: square.clue });
    }
  });

  const owners = new Map<CellNumber, ClueLabel[]>();
  for (const clue of puzzle.clues) {
    for (const cell of new Set(clue.cells)) {
      const labels = owners.get(cell) ?? [];
      labels.push(clue.label);
      owners.set(cell, labels);
    }
  }

  return { letters, owners, clueLabels: new Set(puzzle.clues.map((c) => c.label)) };
}

function checkGridShape(puzzle: Puzzle, ctx: Analysis): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const { columns } = puzzle.grid;
  if (!Number.isInteger(columns) || columns < 1) {
    issues.push(
      error(
        'invalid-columns',
        `The grid's column count must be a positive whole number, got ${columns}.`,
      ),
    );
  }
  if (ctx.letters.length === 0) {
    issues.push(error('no-letter-squares', 'The grid has no letter squares.'));
  }
  return issues;
}

/** V1 and V2: letter squares are numbered 1..N, once each, in reading order. */
function checkSquareNumbers({ letters }: Analysis): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const count = letters.length;
  const byNumber = new Map<CellNumber, number[]>();

  for (const square of letters) {
    if (!Number.isInteger(square.number) || square.number < 1 || square.number > count) {
      issues.push(
        error(
          'invalid-square-number',
          `Square number ${square.number} is outside the range 1–${count}.`,
          { gridIndexes: [square.gridIndex] },
        ),
      );
      continue;
    }
    const seen = byNumber.get(square.number) ?? [];
    seen.push(square.gridIndex);
    byNumber.set(square.number, seen);
  }

  for (const [number, gridIndexes] of byNumber) {
    if (gridIndexes.length > 1) {
      issues.push(
        error(
          'duplicate-square-number',
          `Square number ${number} appears ${gridIndexes.length} times in the grid.`,
          { gridIndexes, cells: [number] },
        ),
      );
    }
  }

  for (let number = 1; number <= count; number++) {
    if (!byNumber.has(number)) {
      issues.push(
        error('missing-square-number', `No grid square is numbered ${number}.`, {
          cells: [number],
        }),
      );
    }
  }

  letters.forEach((square, i) => {
    const expected = i === 0 ? 1 : (letters[i - 1]?.number ?? 0) + 1;
    if (square.number !== expected) {
      issues.push(
        warning(
          'square-number-sequence',
          `Square ${square.number} breaks the numbering sequence (expected ${expected} here). Possibly a misread digit.`,
          { gridIndexes: [square.gridIndex], cells: [square.number] },
        ),
      );
    }
  });

  return issues;
}

/** V5: clue labels are A, B, C, ... with no gaps or duplicates. */
function checkClueLabels(puzzle: Puzzle): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const seen = new Set<ClueLabel>();
  const reported = new Set<ClueLabel>();

  for (const { label } of puzzle.clues) {
    if (seen.has(label) && !reported.has(label)) {
      reported.add(label);
      issues.push(
        error('duplicate-clue-label', `More than one clue is labelled ${label}.`, {
          clues: [label],
        }),
      );
    }
    seen.add(label);
  }

  const firstBreak = puzzle.clues.findIndex((clue, i) => clue.label !== clueLabel(i));
  const breakingClue = puzzle.clues[firstBreak];
  if (breakingClue && !reported.has(breakingClue.label)) {
    issues.push(
      error(
        'clue-label-sequence',
        `Clue ${firstBreak + 1} is labelled ${breakingClue.label}, but ${clueLabel(firstBreak)} was expected. A clue may be missing or out of order.`,
        { clues: [breakingClue.label] },
      ),
    );
  }

  return issues;
}

/** V7: every clue has text and at least one blank, with no repeated blanks. */
function checkClueContents(puzzle: Puzzle): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const clue of puzzle.clues) {
    const clues = [clue.label];
    if (clue.text.trim() === '') {
      issues.push(error('empty-clue-text', `Clue ${clue.label} has no text.`, { clues }));
    }
    if (clue.cells.length === 0) {
      issues.push(
        error('clue-without-cells', `Clue ${clue.label} has no answer blanks.`, { clues }),
      );
    }
    const seen = new Set<CellNumber>();
    for (const cell of clue.cells) {
      if (seen.has(cell)) {
        issues.push(
          error('cell-repeated-in-clue', `Clue ${clue.label} lists blank ${cell} more than once.`, {
            clues,
            cells: [cell],
          }),
        );
      }
      seen.add(cell);
    }
  }
  return issues;
}

/** V3: every grid number is in exactly one clue, and every clue blank is in the grid. */
function checkCellCoverage(puzzle: Puzzle, { letters, owners }: Analysis): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const gridNumbers = new Set(letters.map((square) => square.number));

  for (const [cell, labels] of owners) {
    if (labels.length > 1) {
      issues.push(
        error(
          'cell-in-multiple-clues',
          `Blank ${cell} appears in more than one clue (${labels.join(', ')}).`,
          { cells: [cell], clues: labels },
        ),
      );
    }
  }

  for (const clue of puzzle.clues) {
    for (const cell of new Set(clue.cells)) {
      if (!gridNumbers.has(cell)) {
        issues.push(
          error(
            'cell-not-in-grid',
            `Clue ${clue.label} lists blank ${cell}, but no grid square has that number.`,
            {
              clues: [clue.label],
              cells: [cell],
            },
          ),
        );
      }
    }
  }

  for (const square of letters) {
    if (!owners.has(square.number)) {
      issues.push(
        error('cell-not-in-any-clue', `Square ${square.number} isn't in any clue's blanks.`, {
          gridIndexes: [square.gridIndex],
          cells: [square.number],
        }),
      );
    }
  }

  return issues;
}

/** V4: each square's printed clue label matches the clue whose blanks contain it. */
function checkSquareLabels({ letters, owners, clueLabels }: Analysis): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const square of letters) {
    const labels = owners.get(square.number) ?? [];
    const [owner] = labels;
    if (labels.length === 1 && owner !== undefined && owner !== square.clue) {
      issues.push(
        error(
          'label-mismatch',
          `Square ${square.number} is labelled ${square.clue}, but blank ${square.number} is in clue ${owner}. Change the label to ${owner}?`,
          {
            gridIndexes: [square.gridIndex],
            cells: [square.number],
            clues: [square.clue, owner],
            fix: { kind: 'relabel-square', gridIndex: square.gridIndex, label: owner },
          },
        ),
      );
    } else if (labels.length === 0 && !clueLabels.has(square.clue)) {
      issues.push(
        error(
          'unknown-clue-label',
          `Square ${square.number} is labelled ${square.clue}, but there is no clue ${square.clue}.`,
          {
            gridIndexes: [square.gridIndex],
            cells: [square.number],
          },
        ),
      );
    }
  }
  return issues;
}

/** V8: unusual block placement. Informational only. */
function checkBlockLayout(puzzle: Puzzle): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const { squares } = puzzle.grid;
  const isBlock = (i: number) => squares[i]?.kind === 'block';
  const last = squares.length - 1;

  if (isBlock(0)) {
    issues.push(
      info('leading-block', 'The grid starts with a black square.', { gridIndexes: [0] }),
    );
  }
  if (last > 0 && isBlock(last)) {
    issues.push(
      info('trailing-block', 'The grid ends with a black square.', { gridIndexes: [last] }),
    );
  }
  for (let i = 1; i <= last; i++) {
    if (isBlock(i) && isBlock(i - 1)) {
      issues.push(
        info(
          'adjacent-blocks',
          'Two black squares in a row. Possibly an extra or misread square.',
          {
            gridIndexes: [i - 1, i],
          },
        ),
      );
    }
  }
  return issues;
}

type IssueDetails = Omit<ValidationIssue, 'code' | 'severity' | 'message'>;

function error(code: IssueCode, message: string, details: IssueDetails = {}): ValidationIssue {
  return { code, severity: 'error', message, ...details };
}

function warning(code: IssueCode, message: string, details: IssueDetails = {}): ValidationIssue {
  return { code, severity: 'warning', message, ...details };
}

function info(code: IssueCode, message: string, details: IssueDetails = {}): ValidationIssue {
  return { code, severity: 'info', message, ...details };
}
