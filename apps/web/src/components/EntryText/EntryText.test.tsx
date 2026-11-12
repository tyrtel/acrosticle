import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EntryText } from './EntryText';

describe('EntryText', () => {
  it('renders nothing for an empty square', () => {
    const { container } = render(<EntryText entry={null} space="square" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows a short entry as is, with no callout', () => {
    render(<EntryText entry="TH" space="square" open />);
    expect(screen.getByText('TH')).toBeInTheDocument();
    expect(screen.getAllByText(/TH/)).toHaveLength(1);
  });

  it('cuts a long entry short and offers the whole entry in a callout', () => {
    render(<EntryText entry="THREESOME" space="square" />);
    // Two lines, "THR" and "EE…" (Testing Library reads the line break as a space).
    expect(screen.getByText('THR EE…')).toBeInTheDocument();
    expect(screen.getByText('THREESOME')).toBeInTheDocument();
  });

  it('opens the callout when asked (the square is selected), placed as requested', () => {
    const { rerender } = render(
      <EntryText entry="E or I" space="blank" calloutPlacement="below" />,
    );
    const callout = screen.getByText('E or I');
    expect(callout.className).not.toMatch(/open/);
    expect(callout.className).toMatch(/below/);

    rerender(<EntryText entry="E or I" space="blank" calloutPlacement="below" open />);
    expect(screen.getByText('E or I').className).toMatch(/open/);
  });
});
