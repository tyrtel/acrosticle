import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import mini from '../../../../../samples/puzzles/gridicles-mini-1.json';
import { ImportCrossword } from './ImportCrossword';

describe('ImportCrossword', () => {
  it('reads a chosen file and hands the crossword to the editor', async () => {
    const user = userEvent.setup();
    const onLoad = vi.fn();
    render(<ImportCrossword onLoad={onLoad} />);
    const file = new File([JSON.stringify(mini)], 'mini.json', { type: 'application/json' });
    await user.upload(screen.getByLabelText(/Choose a file/), file);
    await vi.waitFor(() =>
      expect(onLoad).toHaveBeenCalledWith(
        expect.objectContaining({ width: 5, title: 'Gridicles Mini No. 1' }),
      ),
    );
  });

  it('reads pasted text, and explains text it cannot read', async () => {
    const user = userEvent.setup();
    const onLoad = vi.fn();
    render(<ImportCrossword onLoad={onLoad} />);
    await user.click(screen.getByLabelText(/Or paste/));
    await user.paste('not json');
    await user.click(screen.getByRole('button', { name: 'Load crossword' }));
    expect(screen.getByRole('alert')).toHaveTextContent("That crossword couldn't be read");
    expect(onLoad).not.toHaveBeenCalled();

    await user.clear(screen.getByLabelText(/Or paste/));
    await user.paste(JSON.stringify(mini));
    await user.click(screen.getByRole('button', { name: 'Load crossword' }));
    expect(onLoad).toHaveBeenCalledOnce();
  });
});
