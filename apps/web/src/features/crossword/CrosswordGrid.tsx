import type { CellNumber, Marks, SolveState } from '@gridicles/core';
import { getCell } from '@gridicles/core';
import { cellOf, type CrosswordIndex, type CrosswordSelection } from '@gridicles/crossword';
import { squareLabel } from './labels';
import { useCallback, useMemo, type MouseEvent } from 'react';
import { describePeers, type PeerMap } from '../../components/PeerTag';
import { PuzzleGrid, type GridLayout, type SquareView } from '../../components/PuzzleGrid';
import { crosswordSquareId } from './elementIds';

export interface CrosswordGridProps {
  readonly index: CrosswordIndex;
  readonly solve: SolveState;
  readonly selection: CrosswordSelection;
  /** The current word's squares, tinted blue. */
  readonly wordCells: readonly CellNumber[];
  readonly marks: Marks;
  readonly peers: PeerMap;
  /** Typing goes to the grid: show the selected square in yellow, and a focus ring. */
  readonly typing: boolean;
  readonly onSelect: (cell: CellNumber) => void;
  /** Ctrl+click (⌘+click on a Mac) toggles a square's highlight instead of selecting it. */
  readonly onMark: (cell: CellNumber) => void;
}

/** The crossword grid: corner clue numbers, circled and shaded squares, and the solving highlights. */
export function CrosswordGrid({
  index,
  solve,
  selection,
  wordCells,
  marks,
  peers,
  typing,
  onSelect,
  onMark,
}: CrosswordGridProps) {
  const { puzzle } = index;
  const layout = useMemo<GridLayout>(
    () => ({
      columns: puzzle.width,
      squares: puzzle.squares.map((square, i) =>
        square.kind === 'block'
          ? { kind: 'block' }
          : { kind: 'letter', label: squareLabel(index, cellOf(i)) },
      ),
    }),
    [index, puzzle],
  );
  const inWord = new Set(wordCells);

  const viewSquare = (gridIndex: number): SquareView => {
    const square = puzzle.squares[gridIndex];
    if (square?.kind !== 'open') return { ariaLabel: 'Black square' };
    const cell = cellOf(gridIndex);
    const { row, column } = index.positionOf(cell);
    const number = index.numberAt(cell);
    const letter = getCell(solve, cell);
    const marked = marks.has(cell);
    const here = peers.get(cell);
    const who = here ? describePeers(here) : undefined;
    const selected = cell === selection.cell;
    return {
      id: crosswordSquareId(cell),
      ariaLabel: `${number === undefined ? '' : `${number}, `}row ${row + 1}, column ${column + 1}, ${letter ?? 'empty'}${marked ? ', highlighted' : ''}${who ? `, ${who}` : ''}`,
      title: who,
      letter,
      selected,
      tone: inWord.has(cell) ? 'word' : undefined,
      marked,
      circled: square.circled,
      shaded: square.shaded,
      badge: selected ? (selection.direction === 'across' ? '→' : '↓') : undefined,
      barRight: index.hasBar(cell, 'right'),
      barBottom: index.hasBar(cell, 'bottom'),
      peers: here,
    };
  };

  const onSquareClick = useCallback(
    (gridIndex: number, event: MouseEvent) => {
      if (puzzle.squares[gridIndex]?.kind !== 'open') return;
      const cell = cellOf(gridIndex);
      if (event.ctrlKey || event.metaKey) onMark(cell);
      else onSelect(cell);
    },
    [puzzle, onSelect, onMark],
  );

  return (
    <PuzzleGrid
      grid={layout}
      label="Crossword grid"
      viewSquare={viewSquare}
      onSquareClick={onSquareClick}
      showFocus={typing}
      showSelection={typing}
    />
  );
}
