import type { CellNumber, Marks, SolveState } from '@gridicles/core';
import type { PuzzleIndex } from '@gridicles/acrostic';
import { getCell } from '@gridicles/core';
import { useCallback, useMemo, type MouseEvent } from 'react';
import { describePeers, type PeerMap } from '../../components/PeerTag';
import { acrosticLayout, PuzzleGrid, type SquareView } from '../../components/PuzzleGrid';
import { gridSquareId } from './elementIds';

export interface GridProps {
  readonly index: PuzzleIndex;
  readonly solve: SolveState;
  readonly selectedCell: CellNumber;
  /** Squares tinted blue: the word when typing in the grid, the clue's squares when in the clues. */
  readonly highlightCells: readonly CellNumber[];
  /** Squares someone highlighted (green). */
  readonly marks: Marks;
  readonly peers: PeerMap;
  /** Typing goes to the grid: show a focus ring. */
  readonly focused: boolean;
  /** Typing goes to the grid or the clues: show the selected square in yellow. */
  readonly typing: boolean;
  readonly onSelect: (cell: CellNumber) => void;
  /** Ctrl+click (⌘+click on a Mac) toggles a square's highlight instead of selecting it. */
  readonly onMark: (cell: CellNumber) => void;
}

/** The solver's quotation grid. Typing goes through the solver's hidden input. */
export function Grid({
  index,
  solve,
  selectedCell,
  highlightCells,
  marks,
  peers,
  focused,
  typing,
  onSelect,
  onMark,
}: GridProps) {
  const highlighted = new Set(highlightCells);

  const layout = useMemo(() => acrosticLayout(index.puzzle.grid), [index]);
  const viewSquare = (gridIndex: number): SquareView => {
    const square = index.puzzle.grid.squares[gridIndex];
    if (!square) return { ariaLabel: '' };
    switch (square.kind) {
      case 'block':
        return { ariaLabel: 'Black square' };
      case 'punctuation':
        return { ariaLabel: `Punctuation ${square.char}` };
      case 'letter': {
        const letter = getCell(solve, square.number);
        const here = peers.get(square.number);
        const who = here ? describePeers(here) : undefined;
        const marked = marks.has(square.number);
        return {
          id: gridSquareId(square.number),
          ariaLabel: `Square ${square.number}, clue ${square.clue}, ${letter ?? 'empty'}${marked ? ', highlighted' : ''}${who ? `, ${who}` : ''}`,
          title: who,
          letter,
          selected: square.number === selectedCell,
          tone: highlighted.has(square.number) ? 'word' : undefined,
          marked,
          peers: here,
        };
      }
    }
  };

  const { squares } = index.puzzle.grid;
  const onSquareClick = useCallback(
    (gridIndex: number, event: MouseEvent) => {
      const square = squares[gridIndex];
      if (square?.kind !== 'letter') return;
      if (event.ctrlKey || event.metaKey) onMark(square.number);
      else onSelect(square.number);
    },
    [squares, onSelect, onMark],
  );

  return (
    <PuzzleGrid
      grid={layout}
      label="Quotation grid"
      viewSquare={viewSquare}
      onSquareClick={onSquareClick}
      showFocus={focused}
      showSelection={typing}
    />
  );
}
