import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeBackend } from '../../../tests/support/fakeBackend';
import { UploadCrossword } from './UploadCrossword';

let backend: FakeBackend;
beforeEach(() => {
  backend = new FakeBackend();
  backend.install();
});

const photo = () => new File([new Uint8Array(16)], 'grid.png', { type: 'image/png' });
const passThrough = (file: File) => Promise.resolve<Blob>(file);

describe('UploadCrossword', () => {
  it('reads a photo into a draft for the editor, with Claude’s notes', async () => {
    backend.crosswordParseReply = {
      status: 200,
      body: {
        file: { kind: 'crossword', grid: ['..', '..'], clues: { across: [], down: [] } },
        notes: ['Unsure about square 2.'],
        costUsd: 0.004,
      },
    };
    const user = userEvent.setup();
    const onParsed = vi.fn();
    render(<UploadCrossword onParsed={onParsed} prepare={passThrough} />);
    await user.upload(screen.getByLabelText('Choose an image'), photo());
    await user.click(screen.getByRole('button', { name: 'Read the puzzle' }));
    await vi.waitFor(() => expect(onParsed).toHaveBeenCalledOnce());
    expect(onParsed.mock.calls[0]?.[0]).toMatchObject({
      crossword: { width: 2, height: 2 },
      notes: ['Unsure about square 2.'],
    });
  });

  it('explains a failure', async () => {
    const user = userEvent.setup();
    render(<UploadCrossword onParsed={vi.fn()} prepare={passThrough} />);
    await user.upload(screen.getByLabelText('Choose an image'), photo());
    await user.click(screen.getByRole('button', { name: 'Read the puzzle' }));
    expect(await screen.findByRole('alert')).toHaveTextContent("Image parsing isn't set up");
  });
});
