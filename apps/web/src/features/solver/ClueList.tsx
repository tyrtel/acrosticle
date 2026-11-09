import type { CellNumber, Clue, ClueLabel, PuzzleIndex, SolveState } from '@acrosticle/core';
import { getCell } from '@acrosticle/core';
import { memo, type CSSProperties, type KeyboardEventHandler, type Ref } from 'react';
import { describePeers, PeerTag, type Peer, type PeerMap } from '../../components/PeerTag';
import { clueBlankId } from './elementIds';
import styles from './ClueList.module.css';

export interface ClueListProps {
  readonly index: PuzzleIndex;
  readonly solve: SolveState;
  readonly selectedCell: CellNumber;
  readonly selectedClue: ClueLabel;
  readonly peers: PeerMap;
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
  peers,
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
          peersAt={clue.cells.map((cell) => peers.get(cell))}
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
  readonly peersAt: readonly (readonly Peer[] | undefined)[];
  readonly current: boolean;
  readonly selectedCell: CellNumber | null;
  readonly onSelect: (cell: CellNumber) => void;
}

const ClueRow = memo(
  function ClueRow({ clue, letters, peersAt, current, selectedCell, onSelect }: ClueRowProps) {
    return (
      <div role="row" className={current ? `${styles.clue} ${styles.current}` : styles.clue}>
        <div role="rowheader" className={styles.text}>
          <span className={styles.labelText}>{clue.label}.</span> {clue.text}
        </div>
        <div className={styles.blanks}>
          {clue.cells.map((cell, i) => {
            const letter = letters[i] ?? null;
            const selected = cell === selectedCell;
            const here = peersAt[i];
            const peerColor = here?.[0]?.color;
            const who = here ? describePeers(here) : undefined;
            return (
              <div
                key={cell}
                role="gridcell"
                id={clueBlankId(cell)}
                aria-selected={selected}
                aria-label={`Clue ${clue.label}, letter ${i + 1} of ${clue.cells.length}, square ${cell}, ${letter ?? 'empty'}${who ? `, ${who}` : ''}`}
                title={who}
                className={[styles.blank, selected && styles.selected, peerColor && styles.peer]
                  .filter(Boolean)
                  .join(' ')}
                style={peerColor ? ({ '--peer-color': peerColor } as CSSProperties) : undefined}
                onClick={() => onSelect(cell)}
              >
                <span className={styles.letter} aria-hidden="true">
                  {letter}
                </span>
                <span className={styles.number} aria-hidden="true">
                  {cell}
                </span>
                {here && <PeerTag peers={here} className={styles.peerTag} />}
              </div>
            );
          })}
        </div>
      </div>
    );
  },
  // Letters and peer colors arrive as fresh arrays each render; compare them by
  // value so only clues whose contents or selection changed re-render.
  (prev, next) =>
    prev.clue === next.clue &&
    prev.current === next.current &&
    prev.selectedCell === next.selectedCell &&
    prev.onSelect === next.onSelect &&
    sameItems(prev.letters, next.letters) &&
    sameItems(prev.peersAt, next.peersAt),
);

function sameItems<T>(a: readonly T[], b: readonly T[]): boolean {
  return a.length === b.length && a.every((item, i) => item === b[i]);
}
