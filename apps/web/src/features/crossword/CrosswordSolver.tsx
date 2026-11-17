import type { CellEdit, CellNumber, MarkEdit, Marks, SolveState } from '@gridicles/core';
import {
  buildCrosswordIndex,
  clickSquare,
  currentWord,
  enterWord,
  initialCrosswordSelection,
  toggleDirection,
  type Crossword,
  type Word,
} from '@gridicles/crossword';
import { useCallback, useMemo } from 'react';
import type { PeerMap } from '../../components/PeerTag';
import {
  EditTools,
  SolverInput,
  solverShellStyles,
  ToolButton,
  useSolverInput,
} from '../../components/SolverShell';
import { ClueLists } from './ClueLists';
import { CrosswordGrid } from './CrosswordGrid';
import styles from './CrosswordSolver.module.css';
import { crosswordModel } from './crosswordModel';
import { directionName, wordName } from './labels';

const NO_PEERS: PeerMap = new Map();

export interface CrosswordSolverProps {
  /** A crossword with no `validateCrossword` errors. */
  readonly puzzle: Crossword;
  /** The letters to show. The solver doesn't own them; it reports edits instead. */
  readonly solve: SolveState;
  readonly onEdit: (edit: CellEdit) => void;
  readonly marks?: Marks;
  readonly onMark?: (mark: MarkEdit) => void;
  readonly peers?: PeerMap;
  readonly onSelectionChange?: (cell: CellNumber) => void;
}

/**
 * The crossword solving screen. The grid is always in across mode or down
 * mode: typing moves along the current word, arrows across it switch mode,
 * and Space, Enter or clicking the selected square again switch too. Typing,
 * undo, highlights and multi-letter entries come from the shared solver shell.
 */
export function CrosswordSolver({
  puzzle,
  solve,
  onEdit,
  marks,
  onMark,
  peers = NO_PEERS,
  onSelectionChange,
}: CrosswordSolverProps) {
  const index = useMemo(() => buildCrosswordIndex(puzzle), [puzzle]);
  const model = useMemo(() => crosswordModel(index), [index]);
  const {
    selection,
    focused,
    multiLetterOn,
    marks: shownMarks,
    select,
    toggleMark,
    rootRef,
    inputProps,
    toolProps,
  } = useSolverInput({
    model,
    initialSelection: () => initialCrosswordSelection(index),
    solve,
    onEdit,
    marks,
    onMark,
    onSelectionChange,
  });

  const word = currentWord(index, selection);
  const crossing =
    word && index.wordOf(selection.cell, word.direction === 'across' ? 'down' : 'across');

  const selectSquare = useCallback(
    (cell: CellNumber) => select(clickSquare(index, selection, cell)),
    [index, selection, select],
  );
  const selectWord = useCallback(
    (target: Word) => select(enterWord(solve, target)),
    [solve, select],
  );

  const entry = solve[selection.cell];
  const position = word ? word.cells.indexOf(selection.cell) + 1 : 0;
  const where = word
    ? `${wordName(index, word)}: ${word.clue ?? 'no clue'}. Square ${position} of ${word.cells.length}, ${entry ?? 'empty'}${multiLetterOn ? ', typing several letters: Enter saves, Escape cancels' : ''}`
    : '';
  const direction = word?.direction ?? selection.direction;

  return (
    <div className={solverShellStyles.root} ref={rootRef}>
      <header className={styles.header}>
        <h2 className={styles.title}>{puzzle.title ?? 'Untitled crossword'}</h2>
        {puzzle.author && <p className={styles.byline}>By {puzzle.author}</p>}
      </header>
      {puzzle.notes && (
        <details className={styles.notes} open>
          <summary>Instructions</summary>
          <p>{puzzle.notes}</p>
        </details>
      )}
      <SolverInput {...inputProps} describedBy="crossword-where" />
      <p id="crossword-where" className="visually-hidden" aria-live="polite">
        {where}
      </p>
      <div className={styles.layout}>
        <div className={styles.gridPane}>
          <EditTools {...toolProps}>
            <ToolButton
              onClick={() => select(toggleDirection(index, selection))}
              title={`Typing ${directionName(index, direction).toLowerCase()}: switch to ${directionName(index, direction === 'across' ? 'down' : 'across').toLowerCase()} (Space)`}
              aria-label={`Typing ${direction}. Switch direction`}
            >
              {direction === 'across' ? '→ ' : '↓ '}
              {directionName(index, direction)}
            </ToolButton>
          </EditTools>
          <p className={styles.clueBar} aria-hidden="true">
            {word && (
              <>
                <strong>{wordName(index, word)}</strong> {word.clue ?? <em>(no clue)</em>}
              </>
            )}
          </p>
          <CrosswordGrid
            index={index}
            solve={solve}
            selection={selection}
            wordCells={word?.cells ?? []}
            marks={shownMarks}
            peers={peers}
            typing={focused}
            onSelect={selectSquare}
            onMark={toggleMark}
          />
          <p className={styles.hint}>
            Tap or click a square to type · Click it again, or press Space, to switch between across
            and down · Arrows move · Tab next clue · Shift+Enter or Insert for multiple chars ·
            Ctrl+H or Ctrl+click highlights
          </p>
          {puzzle.copyright && <p className={styles.hint}>{puzzle.copyright}</p>}
        </div>
        <ClueLists index={index} current={word} crossing={crossing} onSelect={selectWord} />
      </div>
    </div>
  );
}
