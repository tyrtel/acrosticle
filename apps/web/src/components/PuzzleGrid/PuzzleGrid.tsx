import type { Grid, GridSquare } from '@acrosticle/core';
import { memo, type CSSProperties } from 'react';
import { EntryText } from '../EntryText';
import { PeerTag, type Peer } from '../PeerTag';
import styles from './PuzzleGrid.module.css';

/** How one square should look. Highlight tones are mutually exclusive; `selected` wins while shown. */
export interface SquareView {
  readonly ariaLabel: string;
  readonly id?: string | undefined;
  readonly letter?: string | null | undefined;
  readonly selected?: boolean | undefined;
  readonly tone?: 'word' | 'error' | 'warning' | 'info' | undefined;
  /** Other solvers whose cursor is here: outlined in the first one's color, tagged on hover. */
  readonly peers?: readonly Peer[] | undefined;
  /** Native tooltip text. */
  readonly title?: string | undefined;
}

export interface PuzzleGridProps {
  readonly grid: Grid;
  readonly label: string;
  /** Called for every square on each render; keep it cheap. */
  readonly viewSquare: (square: GridSquare, gridIndex: number) => SquareView;
  readonly onSquareClick?: ((gridIndex: number) => void) | undefined;
  /** Draw a focus ring (typing goes to this grid). */
  readonly showFocus?: boolean | undefined;
  /**
   * Color the selected square. Off while it isn't taking input, so the color
   * means "typing goes here"; the square stays selected for assistive tech.
   */
  readonly showSelection?: boolean | undefined;
}

/**
 * The printed-style acrostic grid: numbered squares with clue labels, black
 * squares and punctuation. Purely presentational; callers decide what each
 * square shows and what clicking does.
 */
export function PuzzleGrid({
  grid,
  label,
  viewSquare,
  onSquareClick,
  showFocus = false,
  showSelection = true,
}: PuzzleGridProps) {
  const rows: { square: GridSquare; gridIndex: number }[][] = [];
  grid.squares.forEach((square, gridIndex) => {
    if (gridIndex % grid.columns === 0) rows.push([]);
    rows[rows.length - 1]?.push({ square, gridIndex });
  });

  return (
    <div
      role="grid"
      aria-label={label}
      className={[styles.grid, showFocus && styles.focused, !showSelection && styles.idle]
        .filter(Boolean)
        .join(' ')}
      style={{ '--columns': grid.columns } as CSSProperties}
    >
      {rows.map((row, r) => (
        <div role="row" className={styles.row} key={r}>
          {row.map(({ square, gridIndex }) => {
            const view = viewSquare(square, gridIndex);
            return (
              <Square
                key={gridIndex}
                square={square}
                gridIndex={gridIndex}
                ariaLabel={view.ariaLabel}
                id={view.id}
                letter={view.letter ?? null}
                selected={view.selected ?? false}
                tone={view.tone}
                peers={view.peers}
                title={view.title}
                calloutPlacement={r === 0 ? 'below' : 'above'}
                onClick={onSquareClick}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

interface SquareProps {
  readonly square: GridSquare;
  readonly gridIndex: number;
  readonly ariaLabel: string;
  readonly id: string | undefined;
  readonly letter: string | null;
  readonly selected: boolean;
  readonly tone: SquareView['tone'];
  readonly peers: readonly Peer[] | undefined;
  readonly title: string | undefined;
  /** The top row's callouts go below, where the grid's scroll area won't clip them. */
  readonly calloutPlacement: 'above' | 'below';
  readonly onClick: ((gridIndex: number) => void) | undefined;
}

// Kind modifiers are mapped explicitly so they can't collide with inner element classes.
const KIND_CLASS: Record<GridSquare['kind'], string | undefined> = {
  letter: styles.letterSquare,
  block: styles.block,
  punctuation: styles.punctuation,
};

const Square = memo(function Square({
  square,
  gridIndex,
  ariaLabel,
  id,
  letter,
  selected,
  tone,
  peers,
  title,
  calloutPlacement,
  onClick,
}: SquareProps) {
  const peerColor = peers?.[0]?.color;
  const classes = [
    styles.square,
    KIND_CLASS[square.kind],
    tone && styles[tone],
    selected && styles.selected,
    onClick && styles.clickable,
    peerColor && styles.peer,
  ];
  return (
    <div
      role="gridcell"
      id={id}
      aria-label={ariaLabel}
      title={title}
      aria-selected={square.kind === 'letter' ? selected : undefined}
      className={classes.filter(Boolean).join(' ')}
      style={peerColor ? ({ '--peer-color': peerColor } as CSSProperties) : undefined}
      onClick={onClick && (() => onClick(gridIndex))}
    >
      {square.kind === 'letter' && (
        <>
          <span className={styles.label} aria-hidden="true">
            {square.number}
            {square.clue}
          </span>
          <span className={styles.entry} aria-hidden="true">
            <EntryText
              entry={letter}
              space="square"
              open={selected}
              calloutPlacement={calloutPlacement}
            />
          </span>
        </>
      )}
      {square.kind === 'punctuation' && <span aria-hidden="true">{square.char}</span>}
      {peers && peers.length > 0 && <PeerTag peers={peers} className={styles.peerTag} />}
    </div>
  );
});
