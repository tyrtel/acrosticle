import type { CellNumber, Marks, SolveState } from '@gridicles/core';
import type { Clue, ClueLabel, PuzzleIndex } from '@gridicles/acrostic';
import { getCell } from '@gridicles/core';
import { memo, type CSSProperties } from 'react';
import { EntryText } from '../../components/EntryText';
import { describePeers, PeerTag, type Peer, type PeerMap } from '../../components/PeerTag';
import { clueBlankId } from './elementIds';
import styles from './ClueList.module.css';

export interface ClueListProps {
  readonly index: PuzzleIndex;
  readonly solve: SolveState;
  readonly selectedCell: CellNumber;
  readonly selectedClue: ClueLabel;
  /** Squares someone highlighted (green). */
  readonly marks: Marks;
  readonly peers: PeerMap;
  /** Typing goes to the clues: show a focus ring. */
  readonly focused: boolean;
  /** Typing goes to the grid or the clues: show the selected blank in yellow. */
  readonly typing: boolean;
  readonly onSelect: (cell: CellNumber) => void;
  /** Ctrl+click (⌘+click on a Mac) toggles a blank's highlight instead of selecting it. */
  readonly onMark: (cell: CellNumber) => void;
}

/** The clues, each with its numbered answer blanks. */
export function ClueList({
  index,
  solve,
  selectedCell,
  selectedClue,
  marks,
  peers,
  focused,
  typing,
  onSelect,
  onMark,
}: ClueListProps) {
  return (
    <div
      role="grid"
      aria-label="Clues"
      className={[styles.list, focused && styles.focused, !typing && styles.idle]
        .filter(Boolean)
        .join(' ')}
    >
      {index.clues.map((clue) => (
        <ClueRow
          key={clue.label}
          clue={clue}
          letters={clue.cells.map((cell) => getCell(solve, cell))}
          peersAt={clue.cells.map((cell) => peers.get(cell))}
          marked={clue.cells.map((cell) => marks.has(cell))}
          current={clue.label === selectedClue}
          selectedCell={clue.label === selectedClue ? selectedCell : null}
          onSelect={onSelect}
          onMark={onMark}
        />
      ))}
    </div>
  );
}

interface ClueRowProps {
  readonly clue: Clue;
  readonly letters: readonly (string | null)[];
  readonly peersAt: readonly (readonly Peer[] | undefined)[];
  readonly marked: readonly boolean[];
  readonly current: boolean;
  readonly selectedCell: CellNumber | null;
  readonly onSelect: (cell: CellNumber) => void;
  readonly onMark: (cell: CellNumber) => void;
}

const ClueRow = memo(
  function ClueRow({
    clue,
    letters,
    peersAt,
    marked,
    current,
    selectedCell,
    onSelect,
    onMark,
  }: ClueRowProps) {
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
            const isMarked = marked[i] ?? false;
            return (
              <div
                key={cell}
                role="gridcell"
                id={clueBlankId(cell)}
                aria-selected={selected}
                aria-label={`Clue ${clue.label}, letter ${i + 1} of ${clue.cells.length}, square ${cell}, ${letter ?? 'empty'}${isMarked ? ', highlighted' : ''}${who ? `, ${who}` : ''}`}
                title={who}
                className={[
                  styles.blank,
                  isMarked && styles.marked,
                  selected && styles.selected,
                  peerColor && styles.peer,
                ]
                  .filter(Boolean)
                  .join(' ')}
                style={peerColor ? ({ '--peer-color': peerColor } as CSSProperties) : undefined}
                onClick={(event) => {
                  if (event.ctrlKey || event.metaKey) onMark(cell);
                  else onSelect(cell);
                }}
              >
                <span className={styles.letter} aria-hidden="true">
                  <EntryText
                    entry={letter}
                    space="blank"
                    open={selected}
                    calloutPlacement="below"
                  />
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
    prev.onMark === next.onMark &&
    sameItems(prev.letters, next.letters) &&
    sameItems(prev.marked, next.marked) &&
    sameItems(prev.peersAt, next.peersAt),
);

function sameItems<T>(a: readonly T[], b: readonly T[]): boolean {
  return a.length === b.length && a.every((item, i) => item === b[i]);
}
