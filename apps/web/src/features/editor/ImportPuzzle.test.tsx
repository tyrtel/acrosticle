import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ImportPuzzle } from './ImportPuzzle';

const file = {
  title: 'Tiny',
  grid: { columns: 2, rows: ['1A 2A'] },
  clues: [{ label: 'A', text: 'Clue', cells: [1, 2] }],
};

function setup() {
  const onImport = vi.fn();
  const user = userEvent.setup();
  render(<ImportPuzzle onImport={onImport} />);
  return { onImport, user };
}

describe('ImportPuzzle', () => {
  it('loads pasted puzzle-file JSON', async () => {
    const { onImport, user } = setup();
    await user.click(screen.getByLabelText('Or paste the file contents'));
    await user.paste(JSON.stringify(file));
    await user.click(screen.getByRole('button', { name: 'Load puzzle' }));
    expect(onImport).toHaveBeenCalledWith(expect.objectContaining({ title: 'Tiny' }));
  });

  it('loads a chosen file', async () => {
    const { onImport, user } = setup();
    const upload = new File([JSON.stringify(file)], 'tiny.json', { type: 'application/json' });
    await user.upload(screen.getByLabelText('Choose a file'), upload);
    expect(onImport).toHaveBeenCalledOnce();
  });

  it('explains invalid JSON', async () => {
    const { onImport, user } = setup();
    await user.click(screen.getByLabelText('Or paste the file contents'));
    await user.paste('{oops');
    await user.click(screen.getByRole('button', { name: 'Load puzzle' }));
    expect(screen.getByRole('alert')).toHaveTextContent("That isn't valid JSON.");
    expect(onImport).not.toHaveBeenCalled();
  });

  it('explains a file that is not a puzzle', async () => {
    const { user } = setup();
    await user.click(screen.getByLabelText('Or paste the file contents'));
    await user.paste('{"grid": 3}');
    await user.click(screen.getByRole('button', { name: 'Load puzzle' }));
    expect(screen.getByRole('alert')).toHaveTextContent("That isn't a valid puzzle file");
  });

  it('disables loading until something is pasted', () => {
    setup();
    expect(screen.getByRole('button', { name: 'Load puzzle' })).toBeDisabled();
  });
});
