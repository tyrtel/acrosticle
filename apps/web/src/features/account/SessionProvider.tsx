import type { MeResponse } from '@acrosticle/protocol';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { fetchMe, signOut as postSignOut } from './accountApi';
import { SessionContext, SIGNED_OUT } from './sessionContext';

interface Loaded {
  readonly loaded: boolean;
  readonly me: MeResponse;
}

/** Loads who is signed in once, and shares it with the whole app. */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Loaded>({ loaded: false, me: SIGNED_OUT });

  useEffect(() => {
    let cancelled = false;
    void fetchMe().then((result) => {
      if (!cancelled) setState({ loaded: true, me: result.ok ? result.value : SIGNED_OUT });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const signOut = useCallback(async () => {
    await postSignOut();
    const result = await fetchMe();
    setState({ loaded: true, me: result.ok ? result.value : SIGNED_OUT });
  }, []);

  const value = useMemo(() => ({ ...state, signOut }), [state, signOut]);
  return <SessionContext value={value}>{children}</SessionContext>;
}
