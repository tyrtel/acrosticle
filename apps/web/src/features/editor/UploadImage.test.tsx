import type { ParsePuzzleResponse } from '@acrosticle/protocol';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeBackend } from '../../../tests/support/fakeBackend';
import { UploadImage } from './UploadImage';

const draft: ParsePuzzleResponse = {
  file: {
    title: 'Tiny',
    grid: { columns: 2, rows: ['1A 2A'] },
    clues: [{ label: 'A', text: 'Clue', cells: [1, 2] }],
  },
  notes: ['The title was faint.'],
  issues: [],
  needsFixes: false,
  costUsd: 0.1,
};

let backend: FakeBackend;
beforeEach(() => {
  backend = new FakeBackend();
  backend.install();
});

const photo = () => new File([new Uint8Array(10)], 'puzzle.jpg', { type: 'image/jpeg' });

function setup() {
  const user = userEvent.setup();
  const onParsed = vi.fn();
  const prepare = vi.fn((file: File) => Promise.resolve(file as Blob));
  render(<UploadImage onParsed={onParsed} prepare={prepare} />);
  return { user, onParsed, prepare };
}

describe('UploadImage', () => {
  it('reads a chosen image into a draft puzzle with notes', async () => {
    backend.parseReply = { status: 200, body: draft };
    const { user, onParsed, prepare } = setup();
    const read = screen.getByRole('button', { name: 'Read the puzzle' });
    expect(read).toBeDisabled();

    await user.upload(screen.getByLabelText('Choose an image'), photo());
    await user.click(read);

    await vi.waitFor(() => expect(onParsed).toHaveBeenCalled());
    const [{ puzzle, notes }] = onParsed.mock.calls[0] as [
      { puzzle: { title: string }; notes: string[] },
    ];
    expect(puzzle.title).toBe('Tiny');
    expect(notes).toEqual(['The title was faint.']);
    expect(prepare).toHaveBeenCalledOnce();
    expect(backend.parsedImages).toHaveLength(1);
  });

  it('shows progress, and Cancel stops the request', async () => {
    backend.parseReply = { status: 200, body: draft };
    backend.parseDelayMs = 10_000;
    const { user, onParsed } = setup();
    await user.upload(screen.getByLabelText('Choose an image'), photo());
    await user.click(screen.getByRole('button', { name: 'Read the puzzle' }));

    expect(await screen.findByRole('status')).toHaveTextContent(/Reading the puzzle… \ds/);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: 'Read the puzzle' })).toBeEnabled();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(onParsed).not.toHaveBeenCalled();
  });

  it.each([
    [503, "Image parsing isn't set up on this server."],
    [429, "Today's image-reading budget is used up. Please try again tomorrow."],
    [422, 'Claude declined to read this image. Try a clearer photo of just the puzzle.'],
  ])('explains a %i from the server', async (status, error) => {
    backend.parseReply = { status, body: { error } };
    const { user } = setup();
    await user.upload(screen.getByLabelText('Choose an image'), photo());
    await user.click(screen.getByRole('button', { name: 'Read the puzzle' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(error);
  });

  it("explains a file that can't be opened as an image", async () => {
    const user = userEvent.setup();
    render(<UploadImage onParsed={vi.fn()} prepare={() => Promise.reject(new Error('bad'))} />);
    await user.upload(screen.getByLabelText('Choose an image'), photo());
    await user.click(screen.getByRole('button', { name: 'Read the puzzle' }));
    expect(await screen.findByRole('alert')).toHaveTextContent("couldn't be opened as an image");
  });
});
