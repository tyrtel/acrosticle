import {
  buildPuzzleIndex,
  describeSelection,
  type CellEdit,
  type CellNumber,
  type Puzzle,
  type SolveState,
} from '@acrosticle/core';
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import type { PeerMap } from '../../components/PeerTag';
import { AcrosticBar } from './AcrosticBar';
import { ClueList } from './ClueList';
import { clueBlankId, gridSquareId } from './elementIds';
import { Grid } from './Grid';
import { keyToAction } from './keymap';
import styles from './Solver.module.css';
import { initialSelection, reduceSolver, type SolverAction } from './solverReducer';

const NO_PEERS: PeerMap = new Map();

export interface SolverProps {
  /** A puzzle that passes `validatePuzzle` without errors. */
  readonly puzzle: Puzzle;
  /** The letters to show. The solver doesn't own them; it reports edits instead. */
  readonly solve: SolveState;
  readonly onEdit: (edit: CellEdit) => void;
  /** Other solvers' cursors. */
  readonly peers?: PeerMap;
  /** Called with the selected cell whenever the cursor moves. */
  readonly onSelectionChange?: (cell: CellNumber) => void;
}

/** The solving screen: grid and clues, kept in sync. Owns only the cursor. */
export function Solver({
  puzzle,
  solve,
  onEdit,
  peers = NO_PEERS,
  onSelectionChange,
}: SolverProps) {
  const index = useMemo(() => buildPuzzleIndex(puzzle), [puzzle]);
  const [selection, setSelection] = useState(() => initialSelection(index));
  const context = describeSelection(index, selection);

  const gridRef = useRef<HTMLDivElement>(null);
  const cluesRef = useRef<HTMLDivElement>(null);

  // Keep keyboard focus on the view being typed in, and the cursor visible.
  useEffect(() => {
    const region = selection.view === 'grid' ? gridRef.current : cluesRef.current;
    const solverHasFocus =
      document.activeElement === gridRef.current || document.activeElement === cluesRef.current;
    if (solverHasFocus && document.activeElement !== region) region?.focus();

    const id =
      selection.view === 'grid' ? gridSquareId(selection.cell) : clueBlankId(selection.cell);
    document.getElementById(id)?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }, [selection]);

  useEffect(() => {
    onSelectionChange?.(selection.cell);
  }, [selection.cell, onSelectionChange]);

  const apply = useCallback(
    (action: SolverAction) => {
      const result = reduceSolver(index, solve, selection, action);
      setSelection(result.selection);
      if (result.edit) onEdit(result.edit);
    },
    [index, solve, selection, onEdit],
  );

  const cluePosition = index.cluePositionOf(context.clue);
  const lastCluePosition = index.clues.length - 1;
  const onKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const action = keyToAction(event, selection.view);
      if (!action) return;
      // Tab past the last clue (or Shift+Tab before the first) leaves the solver,
      // so keyboard users are never trapped.
      const tabbingOut =
        event.key === 'Tab' &&
        ((!event.shiftKey && cluePosition === lastCluePosition) ||
          (event.shiftKey && cluePosition === 0));
      if (tabbingOut) return;
      event.preventDefault();
      apply(action);
    },
    [apply, selection.view, cluePosition, lastCluePosition],
  );
  const selectInGrid = useCallback((cell: CellNumber) => setSelection({ cell, view: 'grid' }), []);
  const selectInClues = useCallback((cell: CellNumber) => setSelection({ cell, view: 'clue' }), []);

  return (
    <div className={styles.solver}>
      <header className={styles.header}>
        <h2 className={styles.title}>{puzzle.title ?? 'Untitled puzzle'}</h2>
        {puzzle.constructedBy && <p className={styles.byline}>By {puzzle.constructedBy}</p>}
      </header>
      <AcrosticBar index={index} solve={solve} />
      <div className={styles.layout}>
        <div className={styles.gridPane}>
          <Grid
            ref={gridRef}
            index={index}
            solve={solve}
            selectedCell={selection.cell}
            wordCells={context.wordCells}
            clueCells={context.clueCells}
            peers={peers}
            active={selection.view === 'grid'}
            onSelect={selectInGrid}
            onKeyDown={onKeyDown}
          />
          <p className={styles.hint}>
            Type to fill · Arrows move · Tab next clue · Enter switches between grid and clues
          </p>
        </div>
        <div className={styles.cluePane}>
          <ClueList
            ref={cluesRef}
            index={index}
            solve={solve}
            selectedCell={selection.cell}
            selectedClue={context.clue}
            peers={peers}
            active={selection.view === 'clue'}
            onSelect={selectInClues}
            onKeyDown={onKeyDown}
          />
        </div>
      </div>
    </div>
  );
}
