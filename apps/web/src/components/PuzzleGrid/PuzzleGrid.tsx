import { memo, type CSSProperties, type MouseEvent } from 'react';
import { EntryText } from '../EntryText';
import { PeerTag, type Peer } from '../PeerTag';
import type { GridLayout, GridShape } from './layout';
import styles from './PuzzleGrid.module.css';

/** How one square should look. Highlight tones are mutually exclusive; `selected` wins while shown. */
export interface SquareView {
  readonly ariaLabel: string;
  readonly id?: string | undefined;
  readonly letter?: string | null | undefined;
  readonly selected?: boolean | undefined;
  readonly tone?: 'word' | 'error' | 'warning' | 'info' | undefined;
  /** Someone highlighted this square: drawn green, over the tone. */
  readonly marked?: boolean | undefined;
  /** Printed with a circle (crosswords). */
  readonly circled?: boolean | undefined;
  /** Printed shaded (crosswords). */
  readonly shaded?: boolean | undefined;
  /** A small mark in the corner, e.g. the crossword typing direction (→ or ↓) on the selected square. */
  readonly badge?: string | undefined;
  /** Other solvers whose cursor is here: outlined in the first one's color, tagged on hover. */
  readonly peers?: readonly Peer[] | undefined;
  /** Native tooltip text. */
  readonly title?: string | undefined;
}

export interface PuzzleGridProps {
  readonly grid: GridLayout;
  readonly label: string;
  /** Called for every square on each render; keep it cheap. */
  readonly viewSquare: (gridIndex: number) => SquareView;
  /** The click event is passed for its modifier keys. */
  readonly onSquareClick?: ((gridIndex: number, event: MouseEvent) => void) | undefined;
  /** Draw a focus ring (typing goes to this grid). */
  readonly showFocus?: boolean | undefined;
  /**
   * Color the selected square. Off while it isn't taking input, so the color
   * means "typing goes here"; the square stays selected for assistive tech.
   */
  readonly showSelection?: boolean | undefined;
}

/**
 * A printed-style puzzle grid: labelled answer squares, black squares and
 * punctuation, for acrostics and crosswords alike. Purely presentational;
 * callers decide what each square shows and what clicking does.
 */
export function PuzzleGrid({
  grid,
  label,
  viewSquare,
  onSquareClick,
  showFocus = false,
  showSelection = true,
}: PuzzleGridProps) {
  const rows: { square: GridShape; gridIndex: number }[][] = [];
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
            const view = viewSquare(gridIndex);
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
                marked={view.marked ?? false}
                circled={view.circled ?? false}
                shaded={view.shaded ?? false}
                badge={view.badge}
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
  readonly square: GridShape;
  readonly gridIndex: number;
  readonly ariaLabel: string;
  readonly id: string | undefined;
  readonly letter: string | null;
  readonly selected: boolean;
  readonly tone: SquareView['tone'];
  readonly marked: boolean;
  readonly circled: boolean;
  readonly shaded: boolean;
  readonly badge: string | undefined;
  readonly peers: readonly Peer[] | undefined;
  readonly title: string | undefined;
  /** The top row's callouts go below, where the grid's scroll area won't clip them. */
  readonly calloutPlacement: 'above' | 'below';
  readonly onClick: ((gridIndex: number, event: MouseEvent) => void) | undefined;
}

// Kind modifiers are mapped explicitly so they can't collide with inner element classes.
const KIND_CLASS: Record<GridShape['kind'], string | undefined> = {
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
  marked,
  circled,
  shaded,
  badge,
  peers,
  title,
  calloutPlacement,
  onClick,
}: SquareProps) {
  const peerColor = peers?.[0]?.color;
  const classes = [
    styles.square,
    KIND_CLASS[square.kind],
    shaded && styles.shaded,
    tone && styles[tone],
    marked && styles.marked,
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
      onClick={onClick && ((event) => onClick(gridIndex, event))}
    >
      {square.kind === 'letter' && (
        <>
          {circled && <span className={styles.circle} aria-hidden="true" />}
          <span className={styles.label} aria-hidden="true">
            {square.label}
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
      {badge && (
        <span className={styles.badge} aria-hidden="true">
          {badge}
        </span>
      )}
      {peers && peers.length > 0 && <PeerTag peers={peers} className={styles.peerTag} />}
    </div>
  );
});
