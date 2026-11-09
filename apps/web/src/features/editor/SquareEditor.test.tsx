import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SquareEditor } from './SquareEditor';

const defaultLetter = { kind: 'letter', number: 9, clue: 'A' } as const;

describe('SquareEditor', () => {
  it('turns a black square into a letter square using the default', async () => {
    const onChange = vi.fn();
    render(
      <SquareEditor square={{ kind: 'block' }} defaultLetter={defaultLetter} onChange={onChange} />,
    );
    await userEvent.selectOptions(screen.getByLabelText('Kind'), 'Letter');
    expect(onChange).toHaveBeenCalledWith(defaultLetter);
  });

  it('edits punctuation', async () => {
    const onChange = vi.fn();
    render(
      <SquareEditor
        square={{ kind: 'punctuation', char: '' }}
        defaultLetter={defaultLetter}
        onChange={onChange}
      />,
    );
    await userEvent.type(screen.getByLabelText('Character'), ';');
    expect(onChange).toHaveBeenCalledWith({ kind: 'punctuation', char: ';' });
  });

  it('turns a letter square into punctuation, and edits numbers', async () => {
    const onChange = vi.fn();
    render(
      <SquareEditor square={defaultLetter} defaultLetter={defaultLetter} onChange={onChange} />,
    );
    await userEvent.type(screen.getByLabelText('Number'), '1');
    expect(onChange).toHaveBeenLastCalledWith({ ...defaultLetter, number: 91 });
    await userEvent.selectOptions(screen.getByLabelText('Kind'), 'Punctuation');
    expect(onChange).toHaveBeenLastCalledWith({ kind: 'punctuation', char: ',' });
  });
});
