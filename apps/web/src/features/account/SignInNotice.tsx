import { SIGN_IN_RESULTS, type SignInResult } from '@acrosticle/protocol';
import { useState } from 'react';
import styles from './Account.module.css';

const MESSAGES: Record<SignInResult, string> = {
  cancelled: 'Sign-in was cancelled.',
  failed: "Sign-in didn't work. Please try again.",
  unverified:
    "Your Google account's email address isn't verified, so it can't be used to sign in here.",
  unconfigured: "Sign-in isn't set up on this server yet.",
};

/** Explains a failed sign-in (`?signin=...` on return from Google), then tidies the URL. */
export function SignInNotice() {
  const [result, setResult] = useState<SignInResult | null>(() => {
    const url = new URL(window.location.href);
    const value = url.searchParams.get('signin');
    if (value === null) return null;
    url.searchParams.delete('signin');
    window.history.replaceState(null, '', url.pathname + url.search + url.hash);
    return SIGN_IN_RESULTS.find((r) => r === value) ?? 'failed';
  });

  if (!result) return null;
  return (
    <p role="alert" className={styles.notice}>
      {MESSAGES[result]}{' '}
      <button type="button" onClick={() => setResult(null)}>
        Dismiss
      </button>
    </p>
  );
}
