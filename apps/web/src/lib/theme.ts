import { useCallback, useState } from 'react';

/** The reader's theme choice. "system" follows the device's light/dark setting. */
export type ThemeChoice = 'system' | 'light' | 'dark';

/** Must match the inline script in index.html. */
export const THEME_KEY = 'acrosticle:theme';

const ORDER: readonly ThemeChoice[] = ['system', 'light', 'dark'];

/** System → Light → Dark → System. */
export function nextTheme(choice: ThemeChoice): ThemeChoice {
  return ORDER[(ORDER.indexOf(choice) + 1) % ORDER.length] ?? 'system';
}

export function loadTheme(): ThemeChoice {
  try {
    const saved = window.localStorage.getItem(THEME_KEY);
    return saved === 'light' || saved === 'dark' ? saved : 'system';
  } catch {
    return 'system';
  }
}

/** Applies a choice to the page and remembers it on this device. */
export function applyTheme(choice: ThemeChoice): void {
  const root = document.documentElement;
  if (choice === 'system') delete root.dataset.theme;
  else root.dataset.theme = choice;
  try {
    if (choice === 'system') window.localStorage.removeItem(THEME_KEY);
    else window.localStorage.setItem(THEME_KEY, choice);
  } catch {
    // Storage can be blocked; the choice still applies for this visit.
  }
}

/** The current theme choice and a function to cycle it. */
export function useTheme(): { choice: ThemeChoice; cycle: () => void } {
  const [choice, setChoice] = useState(loadTheme);
  const cycle = useCallback(() => {
    setChoice((current) => {
      const next = nextTheme(current);
      applyTheme(next);
      return next;
    });
  }, []);
  return { choice, cycle };
}
