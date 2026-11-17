import type { KeyInput } from './model';

/** Keys that work the same in every puzzle type. */
export type SharedAction =
  | { readonly type: 'undo' }
  | { readonly type: 'redo' }
  | { readonly type: 'multiLetter' }
  | { readonly type: 'mark' };

/**
 * | Key                    | Does                                                       |
 * | ---------------------- | ---------------------------------------------------------- |
 * | Ctrl/⌘+Z               | undo your last edit                                        |
 * | Ctrl/⌘+⇧Z, Ctrl+Y      | redo                                                       |
 * | Ctrl+H                 | highlight this square, or remove its highlight (not ⌘H: it hides the app on a Mac) |
 * | ⇧Enter, Insert         | type several characters in this square (multi-letter mode) |
 */
export function sharedKeyAction(input: KeyInput): SharedAction | null {
  if ((input.ctrlKey || input.metaKey) && !input.altKey) {
    const key = input.key.toLowerCase();
    if (key === 'z') return { type: input.shiftKey ? 'redo' : 'undo' };
    if (key === 'y' && input.ctrlKey && !input.shiftKey) return { type: 'redo' };
    if (key === 'h' && input.ctrlKey && !input.metaKey && !input.shiftKey) return { type: 'mark' };
    return null;
  }
  if (input.altKey) return null;
  if (input.key === 'Insert' || (input.key === 'Enter' && input.shiftKey)) {
    return { type: 'multiLetter' };
  }
  return null;
}

/** Ctrl, ⌘ or Alt shortcuts belong to the browser unless sharedKeyAction claimed them. */
export function isBrowserShortcut(input: KeyInput): boolean {
  return Boolean(input.ctrlKey || input.metaKey || input.altKey);
}
