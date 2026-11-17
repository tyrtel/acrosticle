import { buildPuzzleIndex, type Marks, type Puzzle, type SolveState } from '@acrosticle/core';
import { useEffect, useState } from 'react';
import { copyRich } from '../../lib/clipboard';
import { sheetClipboard } from './sheetClipboard';
import { sheetLayout } from './sheetLayout';

/** How long "Copied!" shows before the button reads "Copy to Sheet" again. */
export const COPIED_FOR_MS = 2000;

export interface CopyToSheetButtonProps {
  readonly puzzle: Puzzle;
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
    const { html, text } = sheetClipboard(sheetLayout(buildPuzzleIndex(puzzle), solve, marks));
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
