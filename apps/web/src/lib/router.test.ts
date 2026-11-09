import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { navigate, parseRoute, useRoute } from './router';

const ROOM = 'AbCdEfGhIjKlMnOpQrSt_-';

describe('parseRoute', () => {
  it.each([
    ['/', { kind: 'home' }],
    [`/r/${ROOM}`, { kind: 'room', roomId: ROOM }],
    [`/r/${ROOM}/`, { kind: 'room', roomId: ROOM }],
    ['/my', { kind: 'my' }],
    ['/r/short', { kind: 'not-found' }],
    ['/elsewhere', { kind: 'not-found' }],
  ])('%s', (path, route) => {
    expect(parseRoute(path)).toEqual(route);
  });
});

describe('useRoute / navigate', () => {
  afterEach(() => window.history.pushState(null, '', '/'));

  it('follows navigation and the back button', async () => {
    const { result } = renderHook(() => useRoute());
    expect(result.current).toEqual({ kind: 'home' });

    act(() => navigate(`/r/${ROOM}`));
    expect(result.current).toEqual({ kind: 'room', roomId: ROOM });

    await act(async () => {
      window.history.back();
      await new Promise((resolve) => window.addEventListener('popstate', resolve, { once: true }));
    });
    expect(result.current).toEqual({ kind: 'home' });
  });
});
