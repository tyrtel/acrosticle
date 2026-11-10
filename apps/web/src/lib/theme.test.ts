import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { applyTheme, loadTheme, nextTheme, THEME_KEY, useTheme } from './theme';

afterEach(() => {
  delete document.documentElement.dataset.theme;
});

describe('nextTheme', () => {
  it('cycles System → Light → Dark → System', () => {
    expect(nextTheme('system')).toBe('light');
    expect(nextTheme('light')).toBe('dark');
    expect(nextTheme('dark')).toBe('system');
  });
});

describe('applyTheme / loadTheme', () => {
  it('sets the page theme and remembers it', () => {
    applyTheme('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(window.localStorage.getItem(THEME_KEY)).toBe('dark');
    expect(loadTheme()).toBe('dark');
  });

  it('"system" clears both, so the device setting applies', () => {
    applyTheme('light');
    applyTheme('system');
    expect(document.documentElement.dataset.theme).toBeUndefined();
    expect(window.localStorage.getItem(THEME_KEY)).toBeNull();
    expect(loadTheme()).toBe('system');
  });

  it('ignores unexpected saved values', () => {
    window.localStorage.setItem(THEME_KEY, 'purple');
    expect(loadTheme()).toBe('system');
  });
});

describe('useTheme', () => {
  it('starts from the saved choice and cycles it', () => {
    window.localStorage.setItem(THEME_KEY, 'light');
    const { result } = renderHook(() => useTheme());
    expect(result.current.choice).toBe('light');
    act(() => result.current.cycle());
    expect(result.current.choice).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });
});
