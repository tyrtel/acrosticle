import { applyEdit, emptySolveState, noMarks, setMark, type CellEdit } from '@gridicles/core';
import { crosswordFromFile, type Crossword } from '@gridicles/crossword';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import mini from '../../../../../samples/puzzles/gridicles-mini-1.json';
import { CrosswordSolver } from './CrosswordSolver';

function miniCrossword(): Crossword {
  const result = crosswordFromFile(mini);
  if (!result.ok) throw new Error(result.error);
  return result.crossword;
}

/**
 * The sample mini (cells numbered by position):
 *    1 G   2 A   3 S   #     #
 *    6 A   7 B   8 L   9 E   #
 *   11 S  12 L  13 A  14 T  15 E
 *    #    17 E  18 T  19 N  20 A
 *    #     #    23 E  24 A  25 R
 */
const at = (row: number, column: number) =>
  screen.getByRole('gridcell', { name: new RegExp(`row ${row}, column ${column},`) });
const selected = () =>
  screen.getAllByRole('gridcell').find((cell) => cell.getAttribute('aria-selected') === 'true');

function LocalSolver({ onEdit }: { onEdit?: (edit: CellEdit) => void }) {
  const [solve, setSolve] = useState(emptySolveState);
  const [marks, setMarks] = useState(noMarks);
  return (
    <CrosswordSolver
      puzzle={miniCrossword()}
      solve={solve}
      onEdit={(edit) => {
        onEdit?.(edit);
        setSolve((s) => applyEdit(s, edit));
      }}
      marks={marks}
      onMark={(mark) => setMarks((m) => setMark(m, mark.cell, mark.marked))}
    />
  );
}

function setup(onEdit?: (edit: CellEdit) => void) {
  const user = userEvent.setup();
  render(<LocalSolver onEdit={onEdit} />);
  return { user, direction: () => screen.getByRole('button', { name: /^Typing / }) };
}

describe('CrosswordSolver', () => {
  it('shows the title, numbered grid and both clue lists, starting on 1 Across', () => {
    setup();
    expect(screen.getByRole('heading', { name: 'Gridicles Mini No. 1' })).toBeInTheDocument();
    expect(at(1, 1)).toHaveAccessibleName('1, row 1, column 1, empty');
    expect(at(2, 2)).toHaveAccessibleName('row 2, column 2, empty');
    expect(screen.getAllByRole('gridcell', { name: 'Black square' })).toHaveLength(6);
    const across = screen.getByRole('region', { name: 'Across clues' });
    expect(within(across).getAllByRole('listitem')).toHaveLength(5);
    expect(
      within(across).getByRole('button', { name: '6 Across: Roofing stone' }),
    ).toBeInTheDocument();
    expect(selected()).toBe(at(1, 1));
    // Screen readers hear the current clue and square as the cursor moves.
    expect(screen.getByRole('textbox', { name: 'Answer entry' })).toHaveAccessibleDescription(
      '1 Across: Fuel at the pump. Square 1 of 3, empty',
    );
  });

  it('typing across fills the word and stops at its end', async () => {
    const { user } = setup();
    await user.click(at(3, 1));
    await user.keyboard('SLATEX');
    expect(at(3, 5)).toHaveAccessibleName('7, row 3, column 5, X');
    expect(at(3, 1)).toHaveAccessibleName('6, row 3, column 1, S');
    // Stopped on the last square: nothing spilled into the next word.
    expect(selected()).toBe(at(3, 5));
  });

  it('typing skips filled squares, and over a filled word goes to its last square', async () => {
    const { user } = setup();
    await user.click(at(3, 2));
    await user.keyboard('L');
    await user.click(at(3, 1));
    await user.keyboard('S');
    expect(selected()).toBe(at(3, 3));
    await user.keyboard('ATE');
    await user.click(at(3, 1));
    await user.keyboard('Z');
    expect(selected()).toBe(at(3, 5));
  });

  it('the arrow across the typing direction switches to down without moving; then typing goes down', async () => {
    const { user, direction } = setup();
    await user.click(at(1, 3));
    expect(direction()).toHaveTextContent('Across');
    await user.keyboard('{ArrowDown}');
    expect(selected()).toBe(at(1, 3));
    expect(direction()).toHaveTextContent('Down');
    await user.keyboard('SL');
    expect(at(2, 3)).toHaveAccessibleName('row 2, column 3, L');
    expect(selected()).toBe(at(3, 3));
  });

  it('an arrow along the direction moves exactly one square, filled or not', async () => {
    const { user } = setup();
    await user.click(at(3, 2));
    await user.keyboard('L');
    await user.click(at(3, 1));
    await user.keyboard('{ArrowRight}');
    expect(selected()).toBe(at(3, 2));
    await user.keyboard('{ArrowRight}');
    expect(selected()).toBe(at(3, 3));
  });

  it('Space, Enter, the button, or clicking the selected square switch direction', async () => {
    const { user, direction } = setup();
    await user.click(at(3, 3));
    await user.keyboard(' ');
    expect(direction()).toHaveTextContent('Down');
    await user.keyboard('{Enter}');
    expect(direction()).toHaveTextContent('Across');
    await user.click(at(3, 3));
    expect(direction()).toHaveTextContent('Down');
    await user.click(direction());
    expect(direction()).toHaveTextContent('Across');
    // Space didn't type anything.
    expect(at(3, 3)).toHaveAccessibleName('row 3, column 3, empty');
  });

  it('clicking a clue moves to its first empty square, in its direction', async () => {
    const { user, direction } = setup();
    await user.click(screen.getByRole('button', { name: '3 Down: Clean ___ (fresh start)' }));
    expect(selected()).toBe(at(1, 3));
    expect(direction()).toHaveTextContent('Down');
    expect(screen.getByRole('button', { name: '3 Down: Clean ___ (fresh start)' })).toHaveAttribute(
      'aria-current',
      'true',
    );
  });

  it('Tab goes to the next clue; Backspace clears and steps back in the word', async () => {
    const onEdit = vi.fn();
    const { user } = setup(onEdit);
    // Square 1 starts selected (clicking it would switch to down), so click another square of 1 Across.
    await user.click(at(1, 2));
    await user.keyboard('{Tab}');
    expect(selected()).toBe(at(2, 1));
    await user.keyboard('AB{Backspace}{Backspace}');
    expect(at(2, 1)).toHaveAccessibleName('4, row 2, column 1, empty');
    expect(selected()).toBe(at(2, 1));
    expect(onEdit).toHaveBeenLastCalledWith({ cell: 6, value: null });
  });

  it('shares the multi-letter mode, highlights and undo', async () => {
    const { user } = setup();
    await user.click(at(3, 3));
    await user.keyboard('{Shift>}{Enter}{/Shift}');
    await user.keyboard('HEART{Enter}');
    expect(at(3, 3)).toHaveAccessibleName('row 3, column 3, HEART');
    expect(selected()).toBe(at(3, 4));
    await user.keyboard('{Control>}h{/Control}');
    expect(at(3, 4)).toHaveAccessibleName('row 3, column 4, empty, highlighted');
    await user.keyboard('{Control>}z{/Control}');
    expect(at(3, 3)).toHaveAccessibleName('row 3, column 3, empty');
  });
});
