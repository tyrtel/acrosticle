import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { SignInNotice } from './SignInNotice';

describe('SignInNotice', () => {
  it.each([
    ['cancelled', 'Sign-in was cancelled.'],
    ['failed', "Sign-in didn't work. Please try again."],
    ['unverified', /email address isn't verified/],
    ['unconfigured', "Sign-in isn't set up on this server yet."],
    ['garbage', "Sign-in didn't work. Please try again."],
  ])('explains ?signin=%s and tidies the address', (result, message) => {
    window.history.replaceState(null, '', `/my?signin=${result}&keep=1#top`);
    render(<SignInNotice />);
    expect(screen.getByRole('alert')).toHaveTextContent(message);
    expect(window.location.pathname + window.location.search + window.location.hash).toBe(
      '/my?keep=1#top',
    );
  });

  it('shows nothing normally, and can be dismissed', async () => {
    const { unmount } = render(<SignInNotice />);
    expect(screen.queryByRole('alert')).toBeNull();
    unmount();

    window.history.replaceState(null, '', '/?signin=failed');
    render(<SignInNotice />);
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
