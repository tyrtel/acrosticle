import type { MeResponse } from '@acrosticle/protocol';
import { createContext, use } from 'react';

export interface Session {
  /** False until the first /api/me answer arrives. */
  readonly loaded: boolean;
  readonly me: MeResponse;
  readonly signOut: () => Promise<void>;
}

export const SIGNED_OUT: MeResponse = { user: null, canCreate: false, signInConfigured: false };

export const SessionContext = createContext<Session>({
  loaded: false,
  me: SIGNED_OUT,
  signOut: () => Promise.resolve(),
});

/** Who is signed in, and what they may do. */
export function useSession(): Session {
  return use(SessionContext);
}
