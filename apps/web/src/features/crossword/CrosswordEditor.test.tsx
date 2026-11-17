import { blankCrossword, crosswordFromFile, type Crossword } from '@gridicles/crossword';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeBackend } from '../../../tests/support/fakeBackend';
import mini from '../../../../../samples/puzzles/gridicles-mini-1.json';
import { CrosswordEditor } from './CrosswordEditor';

function miniCrossword(): Crossword {
  const result = crosswordFromFile(mini);
  if (!result.ok) throw new Error(result.error);
  return result.crossword;
}

const square = (row: number, column: number) =>
  screen.getByRole('gridcell', { name: new RegExp(`^Row ${row}, column ${column},`) });
const clueBox = () => screen.getByRole('textbox', { name: 'Clues' });

function setup(initial: Crossword = miniCrossword()) {
  const user = userEvent.setup();
  const onStart = vi.fn();
  render(<CrosswordEditor initial={initial} onStart={onStart} />);
  return { user, onStart, start: () => screen.getByRole('button', { name: 'Start solving' }) };
}

describe('CrosswordEditor', () => {
  it('shows the grid and the clues as text, and starts a room with them', async () => {
    const { user, onStart, start } = setup();
    expect(square(1, 4)).toHaveAccessibleName('Row 1, column 4, black');
    expect((clueBox() as HTMLTextAreaElement).value).toMatch(
      /^ACROSS\n1\. Fuel at the pump\n4\. Capable/,
    );
    expect(screen.queryByRole('list', { name: 'Problems found' })).not.toBeInTheDocument();
    await user.click(start());
    expect(onStart).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Gridicles Mini No. 1', width: 5 }),
    );
  });

  it('toggles squares with their mirror, or alone with symmetry off, and undoes', async () => {
    const { user } = setup(blankCrossword(3, 3));
    await user.click(square(1, 1));
    expect(square(1, 1)).toHaveAccessibleName('Row 1, column 1, black');
    expect(square(3, 3)).toHaveAccessibleName('Row 3, column 3, black');

    await user.click(screen.getByRole('checkbox', { name: 'Symmetric' }));
    await user.click(square(1, 3));
    expect(square(1, 3)).toHaveAccessibleName('Row 1, column 3, black');
    expect(square(3, 1)).toHaveAccessibleName('Row 3, column 1, open');

    await user.click(screen.getByRole('button', { name: '↶ Undo' }));
    expect(square(1, 3)).toHaveAccessibleName('Row 1, column 3, open');
    await user.click(screen.getByRole('button', { name: '↷ Redo' }));
    expect(square(1, 3)).toHaveAccessibleName('Row 1, column 3, black');
  });

  it('resizes the grid', async () => {
    const { user } = setup(blankCrossword(3, 3));
    await user.clear(screen.getByRole('spinbutton', { name: 'Width' }));
    await user.type(screen.getByRole('spinbutton', { name: 'Width' }), '5');
    await user.click(screen.getByRole('button', { name: 'Resize' }));
    expect(square(1, 5)).toBeInTheDocument();
  });

  it('lists problems without blocking, including clue lines it cannot read', async () => {
    const { user, onStart, start } = setup();
    await user.clear(clueBox());
    await user.type(clueBox(), 'ACROSS{Enter}1. Fuel (4){Enter}a stray line');
    const problems = within(screen.getByRole('list', { name: 'Problems found' }));
    expect(problems.getByText("Line 3 isn't a numbered clue.")).toBeInTheDocument();
    expect(
      problems.getByText('The clue for 1 Across says 4 letters, but the grid has 3.'),
    ).toBeInTheDocument();
    expect(problems.getByText('4 Across has no clue.')).toBeInTheDocument();
    expect(start()).toBeEnabled();
    await user.click(start());
    expect(onStart.mock.calls[0]?.[0]).toMatchObject({
      clues: { across: [{ number: 1, text: 'Fuel (4)' }], down: [] },
    });
  });

  it('only stops you when the grid has no open squares', async () => {
    const { user, start } = setup(blankCrossword(2, 2));
    await user.click(square(1, 1));
    await user.click(square(1, 2));
    expect(start()).toBeDisabled();
    expect(screen.getByText(/needs at least one open square/)).toBeInTheDocument();
  });
});

describe('Tidy with Claude', () => {
  let backend: FakeBackend;
  beforeEach(() => {
    backend = new FakeBackend();
    backend.install();
  });

  it('swaps messy text for tidied clues, shows what Claude was unsure of, and can put it back', async () => {
    backend.tidyReply = {
      status: 200,
      body: {
        clues: { across: [{ number: 1, text: 'Fuel at the pump' }], down: [] },
        notes: ['Left out a page number.'],
        costUsd: 0.001,
      },
    };
    const { user } = setup();
    await user.clear(clueBox());
    await user.type(clueBox(), 'p.12 1 Fuel at the pump');
    await user.click(screen.getByRole('button', { name: 'Tidy with Claude' }));

    expect(await screen.findByText('Left out a page number.')).toBeInTheDocument();
    expect(backend.tidiedTexts).toEqual(['p.12 1 Fuel at the pump']);
    expect(clueBox()).toHaveValue('ACROSS\n1. Fuel at the pump\n\nDOWN');

    await user.click(screen.getByRole('button', { name: 'Put my text back' }));
    expect(clueBox()).toHaveValue('p.12 1 Fuel at the pump');
  });

  it('explains when tidying fails, keeping the text', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Tidy with Claude' }));
    expect(await screen.findByRole('alert')).toHaveTextContent("Tidying clues isn't set up");
    expect((clueBox() as HTMLTextAreaElement).value).toMatch(/^ACROSS/);
  });
});
