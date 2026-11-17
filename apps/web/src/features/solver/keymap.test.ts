import { describe, expect, it } from 'vitest';
import { keyToAction } from './keymap';

describe('keyToAction', () => {
  it.each(['q', 'Q', '7', ' ', 'é', 'F5', 'Shift', 'Escape', 'Dead', 'Insert'])(
    'leaves %j to input events or the shell',
    (key) => {
      expect(keyToAction({ key }, 'grid')).toBeNull();
    },
  );

  it.each([{ ctrlKey: true }, { metaKey: true }, { altKey: true }])(
    'leaves modifier shortcuts alone (%o)',
    (modifier) => {
      expect(keyToAction({ key: 'ArrowLeft', ...modifier }, 'grid')).toBeNull();
    },
  );

  it('maps editing keys', () => {
    expect(keyToAction({ key: 'Backspace' }, 'grid')).toEqual({ type: 'erase' });
    expect(keyToAction({ key: 'Delete' }, 'grid')).toEqual({ type: 'clear' });
    expect(keyToAction({ key: 'Enter' }, 'grid')).toEqual({ type: 'toggleView' });
    // Shift+Enter is multi-letter mode, handled by the shell.
    expect(keyToAction({ key: 'Enter', shiftKey: true }, 'grid')).toBeNull();
  });

  it('maps arrows to grid moves in the grid', () => {
    expect(keyToAction({ key: 'ArrowLeft' }, 'grid')).toEqual({ type: 'move', direction: 'left' });
    expect(keyToAction({ key: 'ArrowRight' }, 'grid')).toEqual({
      type: 'move',
      direction: 'right',
    });
    expect(keyToAction({ key: 'ArrowUp' }, 'grid')).toEqual({ type: 'move', direction: 'up' });
    expect(keyToAction({ key: 'ArrowDown' }, 'grid')).toEqual({ type: 'move', direction: 'down' });
  });

  it('maps arrows to steps and clue jumps in the clues', () => {
    expect(keyToAction({ key: 'ArrowLeft' }, 'clue')).toEqual({ type: 'step', delta: -1 });
    expect(keyToAction({ key: 'ArrowRight' }, 'clue')).toEqual({ type: 'step', delta: 1 });
    expect(keyToAction({ key: 'ArrowUp' }, 'clue')).toEqual({ type: 'jumpClue', delta: -1 });
    expect(keyToAction({ key: 'ArrowDown' }, 'clue')).toEqual({ type: 'jumpClue', delta: 1 });
  });

  it('maps Tab and Shift+Tab to clue jumps', () => {
    expect(keyToAction({ key: 'Tab' }, 'grid')).toEqual({ type: 'jumpClue', delta: 1 });
    expect(keyToAction({ key: 'Tab', shiftKey: true }, 'clue')).toEqual({
      type: 'jumpClue',
      delta: -1,
    });
  });
});
