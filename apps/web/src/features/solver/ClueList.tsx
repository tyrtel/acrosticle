import type { CellNumber, Clue, ClueLabel, PuzzleIndex, SolveState } from '@acrosticle/core';
import { getCell } from '@acrosticle/core';
import { memo, type KeyboardEventHandler, type Ref } from 'react';
import { clueBlankId } from './elementIds';
import styles from './ClueList.module.css';

export interface ClueListProps {
  readonly index: PuzzleIndex;
  readonly solve: SolveState;
  readonly selectedCell: CellNumber;
  readonly selectedClue: ClueLabel;
  readonly active: boolean;
  readonly onSelect: (cell: CellNumber) => void;
  readonly onKeyDown: KeyboardEventHandler;
  readonly ref?: Ref<HTMLDivElement>;
}

/** The clues, each with its numbered answer blanks. Focus works like the grid's. */
export function ClueList({
  index,
  solve,
  selectedCell,
  selectedClue,
  active,
  onSelect,
  onKeyDown,
  ref,
}: ClueListProps) {
  return (
    <div
      ref={ref}
      role="grid"
      aria-label="Clues"
      aria-activedescendant={active ? clueBlankId(selectedCell) : undefined}
      tabIndex={0}
      className={styles.list}
      onKeyDown={onKeyDown}
    >
      {index.clues.map((clue) => (
        <ClueRow
          key={clue.label}
          clue={clue}
          letters={clue.cells.map((cell) => getCell(solve, cell))}
          current={clue.label === selectedClue}
          selectedCell={clue.label === selectedClue ? selectedCell : null}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

interface ClueRowProps {
  readonly clue: Clue;
  readonly letters: readonly (string | null)[];
  readonly current: boolean;
  readonly selectedCell: CellNumber | null;
  readonly onSelect: (cell: CellNumber) => void;
}

const ClueRow = memo(
  function ClueRow({ clue, letters, current, selectedCell, onSelect }: ClueRowProps) {
    return (
      <div role="row" className={current ? `${styles.clue} ${styles.current}` : styles.clue}>
        <div role="rowheader" className={styles.text}>
          <span className={styles.labelText}>{clue.label}.</span> {clue.text}
        </div>
        <div className={styles.blanks}>
          {clue.cells.map((cell, i) => {
            const letter = letters[i] ?? null;
            const selected = cell === selectedCell;
            return (
              <div
                key={cell}
                role="gridcell"
                id={clueBlankId(cell)}
                aria-selected={selected}
                aria-label={`Clue ${clue.label}, letter ${i + 1} of ${clue.cells.length}, square ${cell}, ${letter ?? 'empty'}`}
                className={selected ? `${styles.blank} ${styles.selected}` : styles.blank}
                onClick={() => onSelect(cell)}
              >
                <span className={styles.letter} aria-hidden="true">
                  {letter}
                </span>
                <span className={styles.number} aria-hidden="true">
                  {cell}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  },
  // Letters arrive as a fresh array each render; compare them by value so only
  // clues whose letters or selection changed re-render.
  (prev, next) =>
    prev.clue === next.clue &&
    prev.current === next.current &&
    prev.selectedCell === next.selectedCell &&
    prev.onSelect === next.onSelect &&
    prev.letters.length === next.letters.length &&
    prev.letters.every((l, i) => l === next.letters[i]),
);
