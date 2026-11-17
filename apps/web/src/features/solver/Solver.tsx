import type { CellEdit, CellNumber, MarkEdit, Marks, SolveState } from '@gridicles/core';
import {
  buildPuzzleIndex,
  describeSelection,
  type Puzzle,
  type PuzzleIndex,
} from '@gridicles/acrostic';
import { useCallback, useMemo, type CSSProperties } from 'react';
import type { PeerMap } from '../../components/PeerTag';
import {
  EditTools,
  SolverInput,
  solverShellStyles,
  useSolverInput,
} from '../../components/SolverShell';
import { AcrosticBar } from './AcrosticBar';
import { acrosticModel } from './acrosticModel';
import { ClueList } from './ClueList';
import { Grid } from './Grid';
import styles from './Solver.module.css';
import { initialSelection } from './solverReducer';

const NO_PEERS: PeerMap = new Map();

export interface SolverProps {
  /** A puzzle that passes `validatePuzzle` without errors. */
  readonly puzzle: Puzzle;
  /** The letters to show. The solver doesn't own them; it reports edits instead. */
  readonly solve: SolveState;
  readonly onEdit: (edit: CellEdit) => void;
  /** Highlighted squares (green). Like letters, the solver reports changes instead of owning them. */
  readonly marks?: Marks;
  /** Toggle a highlight. Without it, there's no highlighting. */
  readonly onMark?: (mark: MarkEdit) => void;
  /** Other solvers' cursors. */
  readonly peers?: PeerMap;
  /** Called with the selected cell whenever the cursor moves. */
  readonly onSelectionChange?: (cell: CellNumber) => void;
}

/**
 * The acrostic solving screen: grid and clues, kept in sync. Typing, undo,
 * highlights and multi-letter mode come from the shared solver shell; this
 * adds the acrostic's layout and how its cursor moves.
 */
export function Solver({
  puzzle,
  solve,
  onEdit,
  marks,
  onMark,
  peers = NO_PEERS,
  onSelectionChange,
}: SolverProps) {
  const index = useMemo(() => buildPuzzleIndex(puzzle), [puzzle]);
  const model = useMemo(() => acrosticModel(index), [index]);
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
    initialSelection: () => initialSelection(index),
    solve,
    onEdit,
    marks,
    onMark,
    onSelectionChange,
  });
  const context = describeSelection(index, selection);

  const selectInGrid = useCallback((cell: CellNumber) => select({ cell, view: 'grid' }), [select]);
  const selectInClues = useCallback((cell: CellNumber) => select({ cell, view: 'clue' }), [select]);

  const entry = solve[selection.cell];
  const where = `Square ${selection.cell}, clue ${context.clue} letter ${context.position + 1} of ${context.clueCells.length}, ${entry ?? 'empty'}${multiLetterOn ? ', typing several letters: Enter saves, Escape cancels' : ''}`;

  return (
    <div className={solverShellStyles.root} ref={rootRef}>
      <header className={styles.header}>
        <h2 className={styles.title}>{puzzle.title ?? 'Untitled puzzle'}</h2>
        {puzzle.constructedBy && <p className={styles.byline}>By {puzzle.constructedBy}</p>}
      </header>
      <AcrosticBar index={index} solve={solve} />
      <SolverInput {...inputProps} describedBy="solver-where" />
      <p id="solver-where" className="visually-hidden" aria-live="polite">
        {where}
      </p>
      <div className={styles.layout} style={layoutStyle(index)}>
        <div className={styles.gridPane}>
          <EditTools {...toolProps} />
          <Grid
            index={index}
            solve={solve}
            selectedCell={selection.cell}
            highlightCells={selection.view === 'grid' ? context.wordCells : context.clueCells}
            marks={shownMarks}
            peers={peers}
            focused={focused && selection.view === 'grid'}
            typing={focused}
            onSelect={selectInGrid}
            onMark={toggleMark}
          />
          <p className={styles.hint}>
            Tap or click a square to type · Arrows move · Tab next clue · Enter switches between
            grid and clues · Shift+Enter or Insert for multiple chars · Ctrl+H or Ctrl+click
            highlights
          </p>
        </div>
        <div className={styles.cluePane}>
          <ClueList
            index={index}
            solve={solve}
            selectedCell={selection.cell}
            selectedClue={context.clue}
            marks={shownMarks}
            peers={peers}
            focused={focused && selection.view === 'clue'}
            typing={focused}
            onSelect={selectInClues}
            onMark={toggleMark}
          />
        </div>
      </div>
    </div>
  );
}

/** Tells the layout how many blanks the longest clue has, so its column can fit them on one line. */
function layoutStyle(index: PuzzleIndex): CSSProperties {
  const longest = Math.max(0, ...index.clues.map((clue) => clue.cells.length));
  return { '--longest-clue': longest } as CSSProperties;
}
