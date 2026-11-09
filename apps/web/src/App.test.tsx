import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('App', () => {
  it('renders the home page', () => {
    render(<App />);
    expect(screen.getByRole('heading', { level: 1, name: 'Acrosticle' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try the sample puzzle' })).toBeInTheDocument();
  });

  it('shows a not-found message for unknown addresses', () => {
    window.history.replaceState(null, '', '/nowhere');
    render(<App />);
    expect(screen.getByRole('alert')).toHaveTextContent("There's nothing at this address.");
  });
});
