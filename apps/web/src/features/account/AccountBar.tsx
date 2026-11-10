import { signInPath } from '@acrosticle/protocol';
import styles from './Account.module.css';
import { useSession } from './sessionContext';

/** Header controls: sign in, or the signed-in user and Sign out. */
export function AccountBar() {
  const { loaded, me, signOut } = useSession();
  if (!loaded) return null;

  if (!me.user) {
    return (
      <div className={styles.bar}>
        <SignInButton />
      </div>
    );
  }

  return (
    <div className={styles.bar}>
      <span className={styles.user}>
        {me.user.picture && (
          <img
            className={styles.avatar}
            src={me.user.picture}
            alt=""
            referrerPolicy="no-referrer"
            width={28}
            height={28}
          />
        )}
        {me.user.name}
      </span>
      <button type="button" onClick={() => void signOut()}>
        Sign out
      </button>
    </div>
  );
}

/** "Sign in with Google", returning to the current page afterwards. */
export function SignInButton() {
  const { me } = useSession();
  if (!me.signInConfigured) {
    return (
      <span className={styles.unavailable}>
        <button type="button" disabled aria-describedby="sign-in-unavailable">
          Sign in with Google
        </button>
        <span id="sign-in-unavailable">Sign-in isn&apos;t set up on this server yet.</span>
      </span>
    );
  }
  const here = window.location.pathname + window.location.search;
  return (
    <a className={styles.signIn} href={signInPath(here)}>
      Sign in with Google
    </a>
  );
}
