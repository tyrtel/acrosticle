const KEY = 'acrosticle:name';

/** The display name used last time, or "" if none (or storage is unavailable). */
export function loadName(): string {
  try {
    return window.localStorage.getItem(KEY) ?? '';
  } catch {
    return '';
  }
}

export function saveName(name: string): void {
  try {
    window.localStorage.setItem(KEY, name);
  } catch {
    // Storage can be blocked (private windows, settings); remembering the name is optional.
  }
}
