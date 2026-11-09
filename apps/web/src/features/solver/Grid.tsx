import type { CellNumber, GridSquare, PuzzleIndex, SolveState } from '@acrosticle/core';
import { getCell } from '@acrosticle/core';
import { useCallback, type KeyboardEventHandler, type Ref } from 'react';
import { PuzzleGrid, type SquareView } from '../../components/PuzzleGrid';
import { gridSquareId } from './elementIds';

export interface GridProps {
  readonly index: PuzzleIndex;
  readonly solve: SolveState;
  readonly selectedCell: CellNumber;
  readonly wordCells: readonly CellNumber[];
  readonly clueCells: readonly CellNumber[];
  readonly active: boolean;
  readonly onSelect: (cell: CellNumber) => void;
  readonly onKeyDown: KeyboardEventHandler;
  readonly ref?: Ref<HTMLDivElement>;
}

/** The solver's quotation grid. Focus stays on the grid; the selected square is its active descendant. */
export function Grid({
  index,
  solve,
  selectedCell,
  wordCells,
  clueCells,
  active,
  onSelect,
  onKeyDown,
  ref,
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
        return {
          id: gridSquareId(square.number),
          ariaLabel: `Square ${square.number}, clue ${square.clue}, ${letter ?? 'empty'}`,
          letter,
          selected: square.number === selectedCell,
          tone: inWord.has(square.number) ? 'word' : inClue.has(square.number) ? 'clue' : undefined,
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
      ref={ref}
      grid={index.puzzle.grid}
      label="Quotation grid"
      viewSquare={viewSquare}
      onSquareClick={onSquareClick}
      activeDescendant={active ? gridSquareId(selectedCell) : undefined}
      onKeyDown={onKeyDown}
      focusable
    />
  );
}
