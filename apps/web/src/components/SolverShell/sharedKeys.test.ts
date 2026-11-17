import { describe, expect, it } from 'vitest';
import { isBrowserShortcut, sharedKeyAction } from './sharedKeys';

describe('sharedKeyAction', () => {
  it.each([
    [{ key: 'z', ctrlKey: true }, 'undo'],
    [{ key: 'z', metaKey: true }, 'undo'],
    [{ key: 'Z', ctrlKey: true, shiftKey: true }, 'redo'],
    [{ key: 'z', metaKey: true, shiftKey: true }, 'redo'],
    [{ key: 'y', ctrlKey: true }, 'redo'],
    [{ key: 'h', ctrlKey: true }, 'mark'],
    [{ key: 'H', ctrlKey: true }, 'mark'],
    [{ key: 'Enter', shiftKey: true }, 'multiLetter'],
    [{ key: 'Insert' }, 'multiLetter'],
  ])('maps %o to %s', (input, type) => {
    expect(sharedKeyAction(input)).toEqual({ type });
  });

  it.each([
    { key: 'z', altKey: true, ctrlKey: true },
    { key: 'y', metaKey: true },
    // ⌘H hides the app on a Mac; Ctrl+Shift+H is left alone too.
    { key: 'h', metaKey: true },
    { key: 'H', ctrlKey: true, shiftKey: true },
    { key: 'r', ctrlKey: true },
    { key: 'Enter' },
    { key: 'a' },
    { key: 'Insert', altKey: true },
  ])('leaves %o alone', (input) => {
    expect(sharedKeyAction(input)).toBeNull();
  });
});

describe('isBrowserShortcut', () => {
  it.each([{ ctrlKey: true }, { metaKey: true }, { altKey: true }])(
    'is true with %o',
    (modifier) => {
      expect(isBrowserShortcut({ key: 'r', ...modifier })).toBe(true);
    },
  );

  it('is false for plain and shifted keys', () => {
    expect(isBrowserShortcut({ key: 'r' })).toBe(false);
    expect(isBrowserShortcut({ key: 'R', shiftKey: true })).toBe(false);
  });
});
