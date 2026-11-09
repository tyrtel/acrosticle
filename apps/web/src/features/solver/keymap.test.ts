import { describe, expect, it } from 'vitest';
import { keyToAction } from './keymap';

describe('keyToAction', () => {
  it('types letters, normalized to uppercase', () => {
    expect(keyToAction({ key: 'q' }, 'grid')).toEqual({ type: 'input', letter: 'Q' });
    expect(keyToAction({ key: 'Q', shiftKey: true }, 'clue')).toEqual({
      type: 'input',
      letter: 'Q',
    });
  });

  it.each(['1', ' ', '?', 'F5', 'Shift', 'Escape'])('ignores %j', (key) => {
    expect(keyToAction({ key }, 'grid')).toBeNull();
  });

  it.each([{ ctrlKey: true }, { metaKey: true }, { altKey: true }])(
    'leaves modifier shortcuts to the browser (%o)',
    (modifier) => {
      expect(keyToAction({ key: 'r', ...modifier }, 'grid')).toBeNull();
    },
  );

  it('maps editing keys', () => {
    expect(keyToAction({ key: 'Backspace' }, 'grid')).toEqual({ type: 'erase' });
    expect(keyToAction({ key: 'Delete' }, 'grid')).toEqual({ type: 'clear' });
    expect(keyToAction({ key: 'Enter' }, 'grid')).toEqual({ type: 'toggleView' });
  });

  it('maps Tab and Shift+Tab to clue jumps', () => {
    expect(keyToAction({ key: 'Tab' }, 'grid')).toEqual({ type: 'jumpClue', delta: 1 });
    expect(keyToAction({ key: 'Tab', shiftKey: true }, 'grid')).toEqual({
      type: 'jumpClue',
      delta: -1,
    });
  });

  it('moves spatially in the grid view', () => {
    expect(keyToAction({ key: 'ArrowLeft' }, 'grid')).toEqual({ type: 'move', direction: 'left' });
    expect(keyToAction({ key: 'ArrowRight' }, 'grid')).toEqual({
      type: 'move',
      direction: 'right',
    });
    expect(keyToAction({ key: 'ArrowUp' }, 'grid')).toEqual({ type: 'move', direction: 'up' });
    expect(keyToAction({ key: 'ArrowDown' }, 'grid')).toEqual({ type: 'move', direction: 'down' });
  });

  it('moves within and between clues in the clue view', () => {
    expect(keyToAction({ key: 'ArrowLeft' }, 'clue')).toEqual({ type: 'step', delta: -1 });
    expect(keyToAction({ key: 'ArrowRight' }, 'clue')).toEqual({ type: 'step', delta: 1 });
    expect(keyToAction({ key: 'ArrowUp' }, 'clue')).toEqual({ type: 'jumpClue', delta: -1 });
    expect(keyToAction({ key: 'ArrowDown' }, 'clue')).toEqual({ type: 'jumpClue', delta: 1 });
  });
});
