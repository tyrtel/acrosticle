import { type SolveState } from '@gridicles/core';
import { parseCompactGrid, type Puzzle } from '@gridicles/acrostic';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { copyRich } from '../../lib/clipboard';
import { COPIED_FOR_MS, CopyToSheetButton } from './CopyToSheetButton';

vi.mock('../../lib/clipboard', () => ({ copyRich: vi.fn() }));

function tinyPuzzle(): Puzzle {
  const grid = parseCompactGrid(2, ['1A 2A']);
  if (!grid.ok) throw new Error(grid.error);
  return { grid: grid.grid, clues: [{ label: 'A', text: 'Clue', cells: [2, 1] }] };
}

const solve = { 1: 'K' } as unknown as SolveState;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.mocked(copyRich).mockReset();
});

/** Clicks and lets the copy's promise settle. */
async function click() {
  await act(async () => {
    fireEvent.click(screen.getByRole('button'));
    await Promise.resolve();
  });
}

describe('CopyToSheetButton', () => {
  it('copies the puzzle as HTML and text, then says so for a moment', async () => {
    vi.mocked(copyRich).mockResolvedValue(undefined);
    render(
      <CopyToSheetButton
        puzzle={{ kind: 'acrostic', puzzle: tinyPuzzle() }}
        solve={solve}
        marks={new Set([2])}
      />,
    );
    expect(screen.getByRole('button', { name: 'Copy to Sheet' })).toBeInTheDocument();

    await click();
    const [html, text] = vi.mocked(copyRich).mock.calls[0] ?? [];
    expect(html).toContain('<google-sheets-html-origin>');
    expect(html).toContain('background:#bfe8c4');
    expect(text?.split('\n')[0]).toBe('1A\t2A\t\tA. Clue\t\t\t\t\t\t\tK');
    expect(screen.getByRole('button', { name: 'Copied!' })).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(COPIED_FOR_MS);
    });
    expect(screen.getByRole('button', { name: 'Copy to Sheet' })).toBeInTheDocument();
  });

  it('says when the browser refuses', async () => {
    vi.mocked(copyRich).mockRejectedValue(new Error('denied'));
    render(
      <CopyToSheetButton
        puzzle={{ kind: 'acrostic', puzzle: tinyPuzzle() }}
        solve={solve}
        marks={new Set()}
      />,
    );
    await click();
    expect(screen.getByRole('button', { name: "Couldn't copy" })).toBeInTheDocument();
  });
});
