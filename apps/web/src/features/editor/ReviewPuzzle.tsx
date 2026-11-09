import {
  applyFix,
  hasErrors,
  puzzleToCompact,
  replaceSquare,
  updateClue,
  validatePuzzle,
  type GridSquare,
  type IssueSeverity,
  type Puzzle,
  type SuggestedFix,
} from '@acrosticle/core';
import { useCallback, useMemo, useState } from 'react';
import { PuzzleGrid, type SquareView } from '../../components/PuzzleGrid';
import { downloadJson, slugify } from '../../lib/download';
import { ClueEditor } from './ClueEditor';
import styles from './Editor.module.css';
import { IssueList } from './IssueList';
import { SquareEditor } from './SquareEditor';

export interface ReviewPuzzleProps {
  readonly initialPuzzle: Puzzle;
  readonly onStart: (puzzle: Puzzle) => void;
}

const SEVERITY_RANK: Record<IssueSeverity, number> = { error: 3, warning: 2, info: 1 };

/**
 * Review and correct a puzzle before solving: problems are listed and
 * highlighted, squares and clues can be edited, and solving is blocked
 * until there are no errors.
 */
export function ReviewPuzzle({ initialPuzzle, onStart }: ReviewPuzzleProps) {
  const [puzzle, setPuzzle] = useState(initialPuzzle);
  const [selected, setSelected] = useState<number | null>(null);
  const issues = useMemo(() => validatePuzzle(puzzle), [puzzle]);
  const blocked = hasErrors(issues);

  // The most severe issue touching each square or clue, for highlighting.
  const { squareSeverity, flaggedClues } = useMemo(() => {
    const squareSeverity = new Map<number, IssueSeverity>();
    const flaggedClues = new Set<string>();
    for (const issue of issues) {
      for (const gridIndex of issue.gridIndexes ?? []) {
        const current = squareSeverity.get(gridIndex);
        if (!current || SEVERITY_RANK[issue.severity] > SEVERITY_RANK[current]) {
          squareSeverity.set(gridIndex, issue.severity);
        }
      }
      for (const label of issue.clues ?? []) flaggedClues.add(label);
    }
    return { squareSeverity, flaggedClues };
  }, [issues]);

  const viewSquare = (square: GridSquare, gridIndex: number): SquareView => {
    const severity = squareSeverity.get(gridIndex);
    const problem = severity ? `, has ${severity === 'info' ? 'a note' : `an ${severity}`}` : '';
    const name =
      square.kind === 'letter'
        ? `Square ${square.number}, clue ${square.clue}`
        : square.kind === 'block'
          ? 'Black square'
          : `Punctuation ${square.char}`;
    return { ariaLabel: `${name}${problem}`, tone: severity, selected: gridIndex === selected };
  };

  const onFix = useCallback((fix: SuggestedFix) => setPuzzle((p) => applyFix(p, fix)), []);
  const selectedSquare = selected === null ? undefined : puzzle.grid.squares[selected];
  const letterCount = puzzle.grid.squares.filter((s) => s.kind === 'letter').length;
  const firstLabel = puzzle.clues[0]?.label ?? 'A';

  return (
    <div className={styles.review}>
      <h2>Review the puzzle</h2>
      <div className={styles.meta}>
        <label>
          Title{' '}
          <input
            value={puzzle.title ?? ''}
            onChange={(e) => setPuzzle((p) => ({ ...p, title: e.target.value }))}
          />
        </label>
        <label>
          Constructed by{' '}
          <input
            value={puzzle.constructedBy ?? ''}
            onChange={(e) => setPuzzle((p) => ({ ...p, constructedBy: e.target.value }))}
          />
        </label>
      </div>

      <div className={styles.actions}>
        <button type="button" disabled={blocked} onClick={() => onStart(puzzle)}>
          Start solving
        </button>
        <button
          type="button"
          onClick={() =>
            downloadJson(`${slugify(puzzle.title ?? '')}.json`, puzzleToCompact(puzzle))
          }
        >
          Download puzzle file
        </button>
        {blocked && <span className={styles.blockedNote}>Fix the errors to start solving.</span>}
      </div>

      <div className={styles.layout}>
        <div className={styles.gridPane}>
          <PuzzleGrid
            grid={puzzle.grid}
            label="Puzzle grid"
            viewSquare={viewSquare}
            onSquareClick={setSelected}
          />
          {selected !== null && selectedSquare && (
            <SquareEditor
              square={selectedSquare}
              defaultLetter={{ kind: 'letter', number: letterCount + 1, clue: firstLabel }}
              onChange={(square) => setPuzzle((p) => replaceSquare(p, selected, square))}
            />
          )}
        </div>
        <div className={styles.sidePane}>
          <IssueList issues={issues} onFix={onFix} onShow={setSelected} />
          <h3>Clues</h3>
          {puzzle.clues.map((clue) => (
            <ClueEditor
              key={clue.label}
              clue={clue}
              hasIssue={flaggedClues.has(clue.label)}
              onChange={(changes) => setPuzzle((p) => updateClue(p, clue.label, changes))}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
