import { type Marks, type SolveState } from '@gridicles/core';
import { buildPuzzleIndex } from '@gridicles/acrostic';
import { buildCrosswordIndex } from '@gridicles/crossword';
import { useEffect, useState } from 'react';
import { copyRich } from '../../lib/clipboard';
import type { RoomPuzzle } from '../../lib/roomPuzzle';
import { crosswordSheetLayout } from './crosswordSheetLayout';
import { sheetClipboard } from './sheetClipboard';
import { sheetLayout, type SheetLayout } from './sheetLayout';

/** How long "Copied!" shows before the button reads "Copy to Sheet" again. */
export const COPIED_FOR_MS = 2000;

export interface CopyToSheetButtonProps {
  readonly puzzle: RoomPuzzle;
  readonly solve: SolveState;
  readonly marks: Marks;
}

type Status = 'idle' | 'copied' | 'failed';

/** Copies the whole puzzle, letters and highlights, for pasting into Google Sheets. */
export function CopyToSheetButton({ puzzle, solve, marks }: CopyToSheetButtonProps) {
  const [status, setStatus] = useState<Status>('idle');

  useEffect(() => {
    if (status === 'idle') return;
    const timer = setTimeout(() => setStatus('idle'), COPIED_FOR_MS);
    return () => clearTimeout(timer);
  }, [status]);

  const copy = async () => {
    // Built on click only: the layout covers every square, so don't redo it per keystroke.
    const { html, text } = sheetClipboard(layoutFor(puzzle, solve, marks));
    try {
      await copyRich(html, text);
      setStatus('copied');
    } catch {
      setStatus('failed');
    }
  };

  return (
    <button
      type="button"
      onClick={() => void copy()}
      title="Copy the grids and clues, with letters and highlights, to paste into Google Sheets"
    >
      {status === 'copied' ? 'Copied!' : status === 'failed' ? "Couldn't copy" : 'Copy to Sheet'}
    </button>
  );
}

function layoutFor(room: RoomPuzzle, solve: SolveState, marks: Marks): SheetLayout {
  return room.kind === 'crossword'
    ? crosswordSheetLayout(buildCrosswordIndex(room.puzzle), solve, marks)
    : sheetLayout(buildPuzzleIndex(room.puzzle), solve, marks);
}
