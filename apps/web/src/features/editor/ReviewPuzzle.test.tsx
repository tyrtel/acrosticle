import { parsePuzzleFile } from '@acrosticle/protocol';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { samplePuzzleFileAsPrinted } from '../../../tests/support/samples';
import { ReviewPuzzle } from './ReviewPuzzle';

function setup() {
  const parsed = parsePuzzleFile(samplePuzzleFileAsPrinted());
  if (!parsed.ok) throw new Error(parsed.error);
  const onStart = vi.fn();
  const user = userEvent.setup();
  render(<ReviewPuzzle initialPuzzle={parsed.value} onStart={onStart} />);
  return { onStart, user };
}

const startButton = () => screen.getByRole('button', { name: 'Start solving' });
const problems = () => screen.getByRole('region', { name: 'Problems' });

describe('ReviewPuzzle', () => {
  it('lists the misprint, highlights the square and blocks solving', () => {
    setup();
    expect(within(problems()).getByText('1 error, 0 warnings, 0 notes')).toBeInTheDocument();
    expect(problems()).toHaveTextContent('Square 193 is labelled Y, but blank 193 is in clue V.');
    expect(
      screen.getByRole('gridcell', { name: 'Square 193, clue Y, has an error' }),
    ).toBeInTheDocument();
    expect(startButton()).toBeDisabled();
  });

  it('applies the suggested fix, then allows solving with the fixed puzzle', async () => {
    const { onStart, user } = setup();
    await user.click(within(problems()).getByRole('button', { name: 'Fix' }));

    expect(screen.getByText('No problems found.')).toBeInTheDocument();
    expect(screen.getByRole('gridcell', { name: 'Square 193, clue V' })).toBeInTheDocument();
    await user.click(startButton());
    const fixed = onStart.mock.calls[0]?.[0] as { grid: { squares: unknown[] } };
    expect(fixed.grid.squares).toContainEqual({ kind: 'letter', number: 193, clue: 'V' });
  });

  it('edits a square through the square editor', async () => {
    const { user } = setup();
    await user.click(within(problems()).getByRole('button', { name: 'Show' }));
    const clueInput = screen.getByLabelText('Clue');
    await user.clear(clueInput);
    await user.type(clueInput, 'v');
    expect(screen.getByText('No problems found.')).toBeInTheDocument();
  });

  it('turns a square into a black square, which creates new problems', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('gridcell', { name: 'Square 1, clue O' }));
    await user.selectOptions(screen.getByLabelText('Kind'), 'Black square');
    expect(problems()).toHaveTextContent(
      'Clue O lists blank 1, but no grid square has that number.',
    );
  });

  it('edits clue blanks, flagging bad input without losing it', async () => {
    const { user } = setup();
    const blanks = within(screen.getByRole('group', { name: 'Clue A' })).getByLabelText('Blanks');
    await user.type(blanks, ' x');
    expect(blanks).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('"x" is not a square number')).toBeInTheDocument();

    await user.type(blanks, '{Backspace}7');
    expect(blanks).toHaveAttribute('aria-invalid', 'false');
    expect(problems()).toHaveTextContent('Blank 7 appears in more than one clue (A, I).');
  });

  it('edits title and clue text', async () => {
    const { user } = setup();
    const title = screen.getByLabelText('Title');
    await user.clear(title);
    await user.type(title, 'My copy');
    expect(title).toHaveValue('My copy');

    const text = within(screen.getByRole('group', { name: 'Clue B' })).getByLabelText('Text');
    await user.clear(text);
    expect(problems()).toHaveTextContent('Clue B has no text.');
  });
});
