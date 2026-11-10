import type { CellNumber, GridSquare, PuzzleIndex, SolveState } from '@acrosticle/core';
import { getCell } from '@acrosticle/core';
import { useCallback } from 'react';
import { describePeers, type PeerMap } from '../../components/PeerTag';
import { PuzzleGrid, type SquareView } from '../../components/PuzzleGrid';
import { gridSquareId } from './elementIds';

export interface GridProps {
  readonly index: PuzzleIndex;
  readonly solve: SolveState;
  readonly selectedCell: CellNumber;
  readonly wordCells: readonly CellNumber[];
  readonly clueCells: readonly CellNumber[];
  readonly peers: PeerMap;
  /** Typing goes to the grid: show a focus ring. */
  readonly focused: boolean;
  readonly onSelect: (cell: CellNumber) => void;
}

/** The solver's quotation grid. Typing goes through the solver's hidden input. */
export function Grid({
  index,
  solve,
  selectedCell,
  wordCells,
  clueCells,
  peers,
  focused,
  onSelect,
}: GridProps) {
  const inWord = new Set(wordCells);
  const inClue = new Set(clueCells);

  const viewSquare = (square: GridSquare): SquareView => {
    switch (square.kind) {
      case 'block':
        return { ariaLabel: 'Black square' };
      case 'punctuation':
        return { ariaLabel: `Punctuation ${square.char}` };
      case 'letter': {
        const letter = getCell(solve, square.number);
        const here = peers.get(square.number);
        const who = here ? describePeers(here) : undefined;
        return {
          id: gridSquareId(square.number),
          ariaLabel: `Square ${square.number}, clue ${square.clue}, ${letter ?? 'empty'}${who ? `, ${who}` : ''}`,
          title: who,
          letter,
          selected: square.number === selectedCell,
          tone: inWord.has(square.number) ? 'word' : inClue.has(square.number) ? 'clue' : undefined,
          peers: here,
        };
      }
    }
  };

  const { squares } = index.puzzle.grid;
  const onSquareClick = useCallback(
    (gridIndex: number) => {
      const square = squares[gridIndex];
      if (square?.kind === 'letter') onSelect(square.number);
    },
    [squares, onSelect],
  );

  return (
    <PuzzleGrid
      grid={index.puzzle.grid}
      label="Quotation grid"
      viewSquare={viewSquare}
      onSquareClick={onSquareClick}
      showFocus={focused}
    />
  );
}
