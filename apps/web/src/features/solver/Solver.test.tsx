import {
  applyEdit,
  emptySolveState,
  noMarks,
  setMark,
  type CellEdit,
  type CellNumber,
  type MarkEdit,
  type Entry,
  type SolveState,
} from '@gridicles/core';
import { parseCompactGrid, type Puzzle } from '@gridicles/acrostic';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { PeerMap } from '../../components/PeerTag';
import { Solver } from './Solver';

//   1A 2B  #  3A
//   4B  #  5A
// Clue A = 3, 1, 5. Clue B = 4, 2.
function tinyPuzzle(): Puzzle {
  const grid = parseCompactGrid(4, ['1A 2B # 3A', '4B # 5A']);
  if (!grid.ok) throw new Error(grid.error);
  return {
    title: 'Tiny',
    constructedBy: 'Tester',
    grid: grid.grid,
    clues: [
      { label: 'A', text: 'First clue', cells: [3, 1, 5] },
      { label: 'B', text: 'Second clue', cells: [4, 2] },
    ],
  };
}

const square = (n: number) =>
  screen.getByRole('gridcell', { name: new RegExp(`^Square ${n}, clue [A-Z]+, `) });
const blank = (n: number) =>
  screen.getByRole('gridcell', {
    name: new RegExp(`^Clue [A-Z]+, letter \\d+ of \\d+, square ${n}, `),
  });

const puzzle = tinyPuzzle();

/** The solver with local letter state, standing in for a room. */
function LocalSolver(props: {
  peers?: PeerMap;
  onEdit?: (edit: CellEdit) => void;
  onMark?: (mark: MarkEdit) => void;
  onSelectionChange?: (cell: CellNumber) => void;
}) {
  const [solve, setSolve] = useState(emptySolveState);
  const [marks, setMarks] = useState(noMarks);
  return (
    <Solver
      puzzle={puzzle}
      solve={solve}
      onEdit={(edit) => {
        props.onEdit?.(edit);
        setSolve((s) => applyEdit(s, edit));
      }}
      marks={marks}
      onMark={(mark) => {
        props.onMark?.(mark);
        setMarks((m) => setMark(m, mark.cell, mark.marked));
      }}
      peers={props.peers}
      onSelectionChange={props.onSelectionChange}
    />
  );
}

function setup(props: Parameters<typeof LocalSolver>[0] = {}) {
  const user = userEvent.setup();
  render(<LocalSolver {...props} />);
  return {
    user,
    grid: screen.getByRole('grid', { name: 'Quotation grid' }),
    clues: screen.getByRole('grid', { name: 'Clues' }),
    entry: screen.getByRole('textbox', { name: 'Answer entry' }),
  };
}

describe('Solver', () => {
  it('shows the title, byline, grid and clues', () => {
    setup();
    expect(screen.getByRole('heading', { name: 'Tiny' })).toBeInTheDocument();
    expect(screen.getByText('By Tester')).toBeInTheDocument();
    expect(screen.getAllByRole('gridcell', { name: 'Black square' })).toHaveLength(2);
    expect(screen.getByRole('rowheader', { name: 'A. First clue' })).toBeInTheDocument();
    expect(screen.getByText('0 / 5 squares filled')).toBeInTheDocument();
  });

  it('shows multi-character entries readably, with the full entry for assistive tech', () => {
    const solve = { 1: 'THREESOME', 3: 'TH' } as unknown as SolveState;
    render(<Solver puzzle={puzzle} solve={solve} onEdit={vi.fn()} />);

    expect(square(1)).toHaveAccessibleName('Square 1, clue A, THREESOME');
    expect(within(square(1)).getByText('THR EE…')).toBeInTheDocument();
    expect(within(blank(1)).getByText('THR…')).toBeInTheDocument();
    // Square 1 is selected at the start, so its callouts are open.
    expect(within(square(1)).getByText('THREESOME').className).toMatch(/open/);
    expect(within(square(3)).getByText('TH')).toBeInTheDocument();
    // The acrostic takes only the first character of clue A's first square (3).
    expect(screen.getByLabelText(/^First letters:/)).toHaveAccessibleName('First letters: T blank');
  });

  it('sizes the clue column for the longest answer', () => {
    setup();
    // The layout's CSS reads this to fit clue A's 3 blanks on one line.
    const layout = screen.getByRole('grid', { name: 'Clues' }).parentElement?.parentElement;
    expect(layout?.style.getPropertyValue('--longest-clue')).toBe('3');
  });

  it('starts with the first grid square selected', () => {
    const { grid, entry } = setup();
    expect(square(1)).toHaveAttribute('aria-selected', 'true');
    expect(entry).toHaveAccessibleDescription('Square 1, clue A letter 2 of 3, empty');
    expect(grid.className).not.toMatch(/focused/);
  });

  it('typing in the grid fills the matching clue blanks', async () => {
    const { user } = setup();
    await user.click(square(1));
    await user.keyboard('XY');

    expect(square(1)).toHaveAccessibleName('Square 1, clue A, X');
    expect(blank(1)).toHaveAccessibleName('Clue A, letter 2 of 3, square 1, X');
    expect(blank(2)).toHaveAccessibleName('Clue B, letter 2 of 2, square 2, Y');
    expect(square(3)).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('2 / 5 squares filled')).toBeInTheDocument();
  });

  it('typing in a clue fills the matching grid squares, in answer order', async () => {
    const { user, clues, entry } = setup();
    await user.click(blank(3));
    await user.keyboard('ABC');

    expect(square(3)).toHaveAccessibleName('Square 3, clue A, A');
    expect(square(1)).toHaveAccessibleName('Square 1, clue A, B');
    expect(square(5)).toHaveAccessibleName('Square 5, clue A, C');
    expect(entry).toHaveFocus();
    expect(clues.className).toMatch(/focused/);
  });

  it('keeps what was typed: lowercase, digits, symbols and accents', async () => {
    const { user } = setup();
    await user.click(square(1));
    await user.keyboard('a7?é');
    expect(square(1)).toHaveAccessibleName('Square 1, clue A, a');
    expect(square(2)).toHaveAccessibleName('Square 2, clue B, 7');
    expect(square(3)).toHaveAccessibleName('Square 3, clue A, ?');
    expect(square(4)).toHaveAccessibleName('Square 4, clue B, é');
  });

  it('shows the acrostic as first letters are filled', async () => {
    const { user } = setup();
    await user.click(blank(3));
    await user.keyboard('D');
    expect(screen.getByLabelText('First letters: D blank')).toBeInTheDocument();
  });

  it('Enter switches between the grid and the clues, keeping the square', async () => {
    const { user, grid, clues, entry } = setup();
    await user.click(square(2));
    expect(grid.className).toMatch(/focused/);
    await user.keyboard('{Enter}');
    expect(clues.className).toMatch(/focused/);
    expect(blank(2)).toHaveAttribute('aria-selected', 'true');
    expect(entry).toHaveAccessibleDescription('Square 2, clue B letter 2 of 2, empty');

    await user.keyboard('{Enter}');
    expect(grid.className).toMatch(/focused/);
    expect(entry).toHaveFocus();
  });

  describe('text that arrives without key presses (phone keyboards, IMEs)', () => {
    const input = (entry: HTMLElement, inputType: string, data: string | null = null) =>
      fireEvent(entry, new InputEvent('beforeinput', { inputType, data, cancelable: true }));

    it('types inserted text, one square per character', async () => {
      const { user, entry } = setup();
      await user.click(square(1));
      input(entry, 'insertText', 'Wé');
      expect(square(1)).toHaveAccessibleName('Square 1, clue A, W');
      expect(square(2)).toHaveAccessibleName('Square 2, clue B, é');
      expect(square(3)).toHaveAttribute('aria-selected', 'true');
    });

    it('waits for an IME to finish composing, then types the result', async () => {
      const { user, entry } = setup();
      await user.click(square(1));
      fireEvent(
        entry,
        new InputEvent('beforeinput', {
          inputType: 'insertCompositionText',
          data: 'n',
          isComposing: true,
        }),
      );
      expect(square(1)).toHaveAccessibleName('Square 1, clue A, empty');
      fireEvent.compositionEnd(entry, { data: 'ね' });
      expect(square(1)).toHaveAccessibleName('Square 1, clue A, ね');
    });

    describe('Android keyboards that compose every word (Samsung, Gboard)', () => {
      // These keyboards report each letter as composition text and may not end
      // the composition until a space or blur, if ever.
      const composeTo = (entry: HTMLElement, text: string) => {
        const field = entry as HTMLInputElement;
        fireEvent(
          entry,
          new InputEvent('beforeinput', {
            inputType: 'insertCompositionText',
            data: text,
            isComposing: true,
          }),
        );
        field.value = `\u200b${text}`;
        fireEvent(
          entry,
          new InputEvent('input', {
            inputType: 'insertCompositionText',
            data: text,
            isComposing: true,
          }),
        );
      };

      it('types letters as they are composed, without waiting for the composition to end', async () => {
        const { user, entry } = setup();
        await user.click(square(1));
        fireEvent.compositionStart(entry);
        composeTo(entry, 'h');
        expect(square(1)).toHaveAccessibleName('Square 1, clue A, h');
        composeTo(entry, 'hi');
        expect(square(2)).toHaveAccessibleName('Square 2, clue B, i');
        expect(square(3)).toHaveAttribute('aria-selected', 'true');
      });

      it('takes a letter back on Backspace while composing', async () => {
        const { user, entry } = setup();
        await user.click(square(1));
        composeTo(entry, 'hi');
        composeTo(entry, 'h');
        expect(square(2)).toHaveAccessibleName('Square 2, clue B, empty');
        expect(square(2)).toHaveAttribute('aria-selected', 'true');
      });

      it('does not type the word again when the composition finally ends', async () => {
        const { user, entry } = setup();
        await user.click(square(1));
        composeTo(entry, 'hi');
        fireEvent.compositionEnd(entry, { data: 'hi' });
        expect(square(3)).toHaveAccessibleName('Square 3, clue A, empty');
        expect(square(3)).toHaveAttribute('aria-selected', 'true');
      });

      it('starts afresh at a newly tapped square', async () => {
        const { user, entry } = setup();
        await user.click(square(1));
        composeTo(entry, 'h');
        await user.click(square(4));
        composeTo(entry, 'x');
        expect(square(1)).toHaveAccessibleName('Square 1, clue A, h');
        expect(square(4)).toHaveAccessibleName('Square 4, clue B, x');
      });
    });

    it('erases on a phone Backspace (deleteContentBackward) and clears on Delete', async () => {
      const { user, entry } = setup();
      await user.click(square(1));
      input(entry, 'insertText', 'XY');
      input(entry, 'deleteContentBackward');
      expect(square(2)).toHaveAccessibleName('Square 2, clue B, empty');
      expect(square(1)).toHaveAccessibleName('Square 1, clue A, X');

      await user.click(square(1));
      input(entry, 'deleteContentForward');
      expect(square(1)).toHaveAccessibleName('Square 1, clue A, empty');
      expect(square(1)).toHaveAttribute('aria-selected', 'true');
    });

    it('focuses the entry when a square or blank is tapped, so phones open the keyboard', async () => {
      const { user, entry } = setup();
      expect(entry).not.toHaveFocus();
      await user.click(square(4));
      expect(entry).toHaveFocus();
      entry.blur();
      await user.click(blank(3));
      expect(entry).toHaveFocus();
    });
  });

  describe('multi-letter mode', () => {
    const editBox = () => screen.getByRole('textbox', { name: 'Multi-letter entry' });

    it('mentions the shortcuts in the hint under the grid', () => {
      setup();
      expect(screen.getByText(/Shift\+Enter or Insert for multiple chars/)).toBeInTheDocument();
    });

    it('Shift+Enter opens an edit box; Enter saves the whole entry as one edit and advances', async () => {
      const onEdit = vi.fn();
      const { user } = setup({ onEdit });
      await user.click(square(1));
      await user.keyboard('{Shift>}{Enter}{/Shift}');
      expect(editBox()).toHaveFocus();
      expect(editBox()).toHaveValue('');

      await user.keyboard('E or I');
      // Nothing is written until it's saved.
      expect(square(1)).toHaveAccessibleName('Square 1, clue A, empty');
      expect(onEdit).not.toHaveBeenCalled();

      await user.keyboard('{Enter}');
      expect(onEdit).toHaveBeenCalledExactlyOnceWith({ cell: 1, value: 'E or I' });
      expect(square(1)).toHaveAccessibleName('Square 1, clue A, E or I');
      expect(square(2)).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByRole('textbox', { name: 'Answer entry' })).toHaveFocus();
    });

    it('Insert opens the box, and Insert again saves', async () => {
      const { user } = setup();
      await user.click(square(4));
      await user.keyboard('{Insert}TH{Insert}');
      expect(square(4)).toHaveAccessibleName('Square 4, clue B, TH');
    });

    it('starts from what the square holds; Escape cancels without changing it', async () => {
      const { user } = setup();
      await user.click(square(1));
      await user.keyboard('Q');
      await user.click(square(1));
      await user.keyboard('{Insert}');
      expect(editBox()).toHaveValue('Q');
      await user.keyboard('UEUE{Escape}');
      expect(square(1)).toHaveAccessibleName('Square 1, clue A, Q');
      expect(square(1)).toHaveAttribute('aria-selected', 'true');
    });

    it('clears the square when saved empty, staying on it', async () => {
      const { user } = setup();
      await user.click(square(1));
      await user.keyboard('{Insert}TH{Enter}');
      await user.click(square(1));
      await user.keyboard('{Insert}');
      await user.clear(editBox());
      await user.keyboard('{Enter}');
      expect(square(1)).toHaveAccessibleName('Square 1, clue A, empty');
      expect(square(1)).toHaveAttribute('aria-selected', 'true');
    });

    it('keeps the typing when another square is clicked, then moves there', async () => {
      const { user } = setup();
      await user.click(square(1));
      await user.keyboard('{Insert}ST');
      await user.click(square(4));
      expect(square(1)).toHaveAccessibleName('Square 1, clue A, ST');
      expect(square(4)).toHaveAttribute('aria-selected', 'true');
      expect(screen.queryByRole('textbox', { name: 'Multi-letter entry' })).toBeNull();
    });

    it('works from the clue list too, advancing along the answer', async () => {
      const { user } = setup();
      await user.click(blank(3));
      await user.keyboard('{Shift>}{Enter}{/Shift}TH{Enter}');
      expect(blank(3)).toHaveAccessibleName(/^Clue A, letter 1 of 3, square 3, TH$/);
      expect(blank(1)).toHaveAttribute('aria-selected', 'true');
    });

    it('has a Multi-letter button for phones and mice, showing whether the mode is on', async () => {
      const { user } = setup();
      await user.click(square(2));
      const button = screen.getByRole('button', { name: 'Multi-letter' });
      expect(button).toHaveAttribute('aria-pressed', 'false');
      await user.click(button);
      expect(button).toHaveAttribute('aria-pressed', 'true');
      expect(editBox()).toHaveFocus();
      await user.keyboard('ING');
      await user.click(button);
      expect(button).toHaveAttribute('aria-pressed', 'false');
      expect(square(2)).toHaveAccessibleName('Square 2, clue B, ING');
    });

    it('is undone in one step', async () => {
      const { user } = setup();
      await user.click(square(1));
      await user.keyboard('Q');
      await user.click(square(1));
      await user.keyboard('{Insert}QUEUE{Enter}');
      await user.click(screen.getByRole('button', { name: /Undo/ }));
      expect(square(1)).toHaveAccessibleName('Square 1, clue A, Q');
    });

    it('cancels when Undo is used mid-edit', async () => {
      const { user } = setup();
      await user.click(square(1));
      await user.keyboard('Q');
      await user.click(square(2));
      await user.keyboard('{Insert}XYZ');
      await user.click(screen.getByRole('button', { name: /Undo/ }));
      expect(square(1)).toHaveAccessibleName('Square 1, clue A, empty');
      expect(square(2)).toHaveAccessibleName('Square 2, clue B, empty');
    });

    it('does not spread a pasted or composed word across squares while editing', async () => {
      const { user, entry } = setup();
      await user.click(square(1));
      await user.keyboard('{Insert}');
      fireEvent.compositionEnd(entry, { data: 'ねこ' });
      expect(square(1)).toHaveAccessibleName('Square 1, clue A, empty');
      expect(square(2)).toHaveAccessibleName('Square 2, clue B, empty');
    });
  });

  describe('highlights', () => {
    const highlightButton = () => screen.getByRole('button', { name: 'Highlight' });

    it('Ctrl+H highlights the selected square in the grid and clues, and again removes it', async () => {
      const onMark = vi.fn();
      const { user, entry } = setup({ onMark });
      await user.click(square(1));
      await user.keyboard('{Control>}h{/Control}');

      expect(onMark).toHaveBeenCalledExactlyOnceWith({ cell: 1, marked: true });
      expect(square(1)).toHaveAccessibleName('Square 1, clue A, empty, highlighted');
      expect(blank(1)).toHaveAccessibleName('Clue A, letter 2 of 3, square 1, empty, highlighted');
      expect(highlightButton()).toHaveAttribute('aria-pressed', 'true');
      // The cursor stays put, ready to type.
      expect(square(1)).toHaveAttribute('aria-selected', 'true');
      expect(entry).toHaveFocus();

      await user.keyboard('{Control>}h{/Control}');
      expect(onMark).toHaveBeenLastCalledWith({ cell: 1, marked: false });
      expect(square(1)).toHaveAccessibleName('Square 1, clue A, empty');
      expect(highlightButton()).toHaveAttribute('aria-pressed', 'false');
    });

    it.each([
      ['Ctrl', 'Control'],
      ['⌘', 'Meta'],
    ])('%s+click toggles a square or blank without moving the cursor', async (_, modifier) => {
      const onMark = vi.fn();
      const { user } = setup({ onMark });
      await user.click(square(1));
      await user.keyboard(`{${modifier}>}`);
      await user.click(square(4));
      await user.click(blank(5));
      await user.keyboard(`{/${modifier}}`);

      expect(onMark.mock.calls).toEqual([[{ cell: 4, marked: true }], [{ cell: 5, marked: true }]]);
      expect(square(4)).toHaveAccessibleName('Square 4, clue B, empty, highlighted');
      expect(square(5)).toHaveAccessibleName('Square 5, clue A, empty, highlighted');
      expect(square(1)).toHaveAttribute('aria-selected', 'true');
    });

    it('the Highlight button toggles the selected square and keeps typing focus', async () => {
      const { user, entry } = setup();
      await user.click(square(2));
      await user.click(highlightButton());
      expect(square(2)).toHaveAccessibleName('Square 2, clue B, empty, highlighted');
      expect(entry).toHaveFocus();

      // A letter typed now still lands in the highlighted square.
      await user.keyboard('Q');
      expect(square(2)).toHaveAccessibleName('Square 2, clue B, Q, highlighted');
    });

    it("isn't part of Undo", async () => {
      const { user } = setup();
      await user.click(square(1));
      await user.keyboard('{Control>}h{/Control}');
      expect(screen.getByRole('button', { name: /Undo/ })).toBeDisabled();
    });

    it('shows highlights made by others', () => {
      render(
        <Solver
          puzzle={puzzle}
          solve={{}}
          onEdit={vi.fn()}
          marks={new Set([3])}
          onMark={vi.fn()}
        />,
      );
      expect(square(3)).toHaveAccessibleName('Square 3, clue A, empty, highlighted');
      expect(blank(3)).toHaveAccessibleName('Clue A, letter 1 of 3, square 3, empty, highlighted');
    });

    it('offers no highlighting without onMark', async () => {
      const user = userEvent.setup();
      render(<Solver puzzle={puzzle} solve={{}} onEdit={vi.fn()} />);
      expect(screen.queryByRole('button', { name: 'Highlight' })).not.toBeInTheDocument();
      await user.click(square(1));
      await user.keyboard('{Control>}h{/Control}');
      expect(square(1)).toHaveAccessibleName('Square 1, clue A, empty');
    });
  });

  describe('undo and redo', () => {
    it('undoes your edits with the button or Ctrl+Z, newest first, and redoes them', async () => {
      const { user } = setup();
      const undoButton = screen.getByRole('button', { name: /Undo/ });
      const redoButton = screen.getByRole('button', { name: /Redo/ });
      expect(undoButton).toBeDisabled();

      await user.click(square(1));
      await user.keyboard('XY');
      expect(undoButton).toBeEnabled();

      await user.keyboard('{Control>}z{/Control}');
      expect(square(2)).toHaveAccessibleName('Square 2, clue B, empty');
      expect(square(2)).toHaveAttribute('aria-selected', 'true'); // cursor follows the undo

      await user.click(undoButton);
      expect(square(1)).toHaveAccessibleName('Square 1, clue A, empty');
      expect(undoButton).toBeDisabled();

      await user.keyboard('{Control>}{Shift>}z{/Shift}{/Control}');
      expect(square(1)).toHaveAccessibleName('Square 1, clue A, X');
      await user.click(redoButton);
      expect(square(2)).toHaveAccessibleName('Square 2, clue B, Y');
      expect(redoButton).toBeDisabled();
    });

    it('keeps typing focus after clicking the buttons', async () => {
      const { user, entry } = setup();
      await user.click(square(1));
      await user.keyboard('X');
      await user.click(screen.getByRole('button', { name: /Undo/ }));
      expect(entry).toHaveFocus();
    });

    it('restores what was there before, including a cleared square', async () => {
      const { user } = setup();
      await user.click(square(1));
      await user.keyboard('X{ArrowLeft}{Delete}');
      expect(square(1)).toHaveAccessibleName('Square 1, clue A, empty');
      await user.keyboard('{Control>}z{/Control}');
      expect(square(1)).toHaveAccessibleName('Square 1, clue A, X');
    });

    it('skips your edits that someone else has since changed', async () => {
      const onEdit = vi.fn();
      const user = userEvent.setup();
      const { rerender } = render(
        <Solver puzzle={puzzle} solve={emptySolveState} onEdit={onEdit} />,
      );
      await user.click(square(1));
      await user.keyboard('A');
      const mine = applyEdit(emptySolveState, { cell: 1, value: 'A' as Entry });
      rerender(<Solver puzzle={puzzle} solve={mine} onEdit={onEdit} />);

      // A collaborator overwrites square 1.
      const theirs = applyEdit(mine, { cell: 1, value: 'Q' as Entry });
      rerender(<Solver puzzle={puzzle} solve={theirs} onEdit={onEdit} />);
      expect(screen.getByRole('button', { name: /Undo/ })).toBeDisabled();

      onEdit.mockClear();
      await user.keyboard('{Control>}z{/Control}');
      expect(onEdit).not.toHaveBeenCalled();
    });
  });

  it('Tab jumps to the next clue', async () => {
    const { user } = setup();
    await user.click(square(1));
    await user.keyboard('{Tab}');
    expect(blank(4)).toHaveAttribute('aria-selected', 'true');
  });

  it('Tab past the last clue leaves the solver instead of trapping focus', async () => {
    const { user, entry } = setup();
    await user.click(blank(4));
    await user.keyboard('{Tab}');
    expect(entry).not.toHaveFocus();
    expect(blank(4)).toHaveAttribute('aria-selected', 'true');
  });

  it('Shift+Tab before the first clue leaves the solver too', async () => {
    const { user, entry } = setup();
    await user.click(blank(3));
    await user.keyboard('{Shift>}{Tab}{/Shift}');
    expect(entry).not.toHaveFocus();
  });

  it('arrow keys move around the grid', async () => {
    const { user } = setup();
    await user.click(square(1));
    await user.keyboard('{ArrowDown}');
    expect(square(4)).toHaveAttribute('aria-selected', 'true');
  });

  it('Backspace clears and moves back', async () => {
    const { user } = setup();
    await user.click(square(1));
    await user.keyboard('XY{Backspace}{Backspace}');
    expect(square(1)).toHaveAccessibleName('Square 1, clue A, empty');
    expect(square(2)).toHaveAccessibleName('Square 2, clue B, empty');
  });

  it('highlights the current clue', async () => {
    const { user } = setup();
    await user.click(square(2));
    const rows = within(screen.getByRole('grid', { name: 'Clues' })).getAllByRole('row');
    expect(rows[1]?.className).toMatch(/current/);
    expect(rows[0]?.className).not.toMatch(/current/);
  });

  it("tints the word when typing in the grid, and the clue's squares when typing in the clues", async () => {
    const tinted = () => [1, 2, 3, 4, 5].filter((n) => /\bword\b|_word_/.test(square(n).className));
    const { user } = setup();
    // Square 1 is in the word 1-2 and in clue A (3, 1, 5).
    await user.click(square(1));
    expect(tinted()).toEqual([1, 2]);

    await user.keyboard('{Enter}');
    expect(tinted()).toEqual([1, 3, 5]);
  });

  it('shows the yellow selection only while typing, keeping the square selected', async () => {
    const { user, grid, clues, entry } = setup();
    expect(grid.className).toMatch(/idle/);
    expect(clues.className).toMatch(/idle/);

    await user.click(square(2));
    expect(grid.className).not.toMatch(/idle/);
    expect(clues.className).not.toMatch(/idle/);

    await user.keyboard('{Enter}');
    expect(grid.className).not.toMatch(/idle/);
    expect(clues.className).not.toMatch(/idle/);

    entry.blur();
    await vi.waitFor(() => expect(grid.className).toMatch(/idle/));
    expect(clues.className).toMatch(/idle/);
    expect(square(2)).toHaveAttribute('aria-selected', 'true');
    expect(blank(2)).toHaveAttribute('aria-selected', 'true');
  });

  it('reports each edit, and nothing for plain cursor moves', async () => {
    const onEdit = vi.fn();
    const { user } = setup({ onEdit });
    await user.click(square(1));
    await user.keyboard('{ArrowRight}Q{Backspace}');
    expect(onEdit.mock.calls).toEqual([[{ cell: 2, value: 'Q' }], [{ cell: 2, value: null }]]);
  });

  it('reports cursor moves for sharing with others', async () => {
    const onSelectionChange = vi.fn();
    const { user } = setup({ onSelectionChange });
    expect(onSelectionChange).toHaveBeenLastCalledWith(1);
    await user.click(square(4));
    expect(onSelectionChange).toHaveBeenLastCalledWith(4);
  });

  it("outlines other solvers' cursors in their color, in both views", () => {
    setup({ peers: new Map([[3, [{ id: 'bo', name: 'Bo Diddley', color: '#123456' }]]]) });
    expect(square(3).style.getPropertyValue('--peer-color')).toBe('#123456');
    expect(blank(3).style.getPropertyValue('--peer-color')).toBe('#123456');
    expect(square(4).style.getPropertyValue('--peer-color')).toBe('');
  });

  it('says who is on a square, with initials for the hover tag', () => {
    const peers: PeerMap = new Map([
      [
        3,
        [
          { id: 'bo', name: 'Bo Diddley', color: '#123456' },
          { id: 'cy', name: 'Cy', color: '#654321' },
        ],
      ],
    ]);
    setup({ peers });
    expect(square(3)).toHaveAccessibleName('Square 3, clue A, empty, Bo Diddley and Cy are here');
    expect(square(3)).toHaveAttribute('title', 'Bo Diddley and Cy are here');
    expect(blank(3)).toHaveAccessibleName(
      'Clue A, letter 1 of 3, square 3, empty, Bo Diddley and Cy are here',
    );
    expect(square(3)).toHaveTextContent('BDC');
    expect(square(4)).not.toHaveAttribute('title');
  });
});
