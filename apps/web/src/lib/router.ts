import { ROOM_ID_PATTERN } from '@acrosticle/protocol';
import { useSyncExternalStore } from 'react';

/**
 * A minimal router for the app's two pages. Deliberately tiny: if routes grow
 * beyond a handful, switch to a router library instead of extending this.
 */
export type Route =
  | { readonly kind: 'home' }
  | { readonly kind: 'room'; readonly roomId: string }
  | { readonly kind: 'my' }
  | { readonly kind: 'not-found' };

export function parseRoute(pathname: string): Route {
  if (pathname === '/' || pathname === '') return { kind: 'home' };
  if (pathname === '/my' || pathname === '/my/') return { kind: 'my' };
  const room = /^\/r\/([^/]+)\/?$/.exec(pathname);
  const roomId = room?.[1];
  if (roomId !== undefined && ROOM_ID_PATTERN.test(roomId)) return { kind: 'room', roomId };
  return { kind: 'not-found' };
}

export function navigate(path: string): void {
  window.history.pushState(null, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener('popstate', onChange);
  return () => window.removeEventListener('popstate', onChange);
}

const getPathname = () => window.location.pathname;

/** The current route; re-renders on navigation and browser back/forward. */
export function useRoute(): Route {
  const pathname = useSyncExternalStore(subscribe, getPathname);
  return parseRoute(pathname);
}
