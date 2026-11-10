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
const getSearch = () => window.location.search;

/** The current route; re-renders on navigation and browser back/forward. */
export function useRoute(): Route {
  const pathname = useSyncExternalStore(subscribe, getPathname);
  return parseRoute(pathname);
}

/** One query parameter of the current address (e.g. `panel` in `/?panel=my`), live. */
export function useSearchParam(name: string): string | null {
  const search = useSyncExternalStore(subscribe, getSearch);
  return new URLSearchParams(search).get(name);
}

/**
 * Sets or removes one query parameter, keeping the rest of the address. Adds a
 * history entry, so the browser's Back button undoes it (e.g. closes a panel).
 */
export function setSearchParam(name: string, value: string | null): void {
  const url = new URL(window.location.href);
  if (value === null) url.searchParams.delete(name);
  else url.searchParams.set(name, value);
  navigate(`${url.pathname}${url.search}${url.hash}`);
}
