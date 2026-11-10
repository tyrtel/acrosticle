import { describe, expect, it } from 'vitest';
import { keyToAction } from './keymap';

describe('keyToAction', () => {
  it('types any single character, keeping its case', () => {
    expect(keyToAction({ key: 'q' }, 'grid')).toEqual({ type: 'input', entry: 'q' });
    expect(keyToAction({ key: 'Q', shiftKey: true }, 'clue')).toEqual({
      type: 'input',
      entry: 'Q',
    });
    expect(keyToAction({ key: '7' }, 'grid')).toEqual({ type: 'input', entry: '7' });
    expect(keyToAction({ key: '?' }, 'grid')).toEqual({ type: 'input', entry: '?' });
    expect(keyToAction({ key: 'é' }, 'grid')).toEqual({ type: 'input', entry: 'é' });
  });

  it('counts characters, not UTF-16 units', () => {
    // U+1D49C (mathematical script A) takes two UTF-16 units.
    expect(keyToAction({ key: '\u{1D49C}' }, 'grid')).toEqual({
      type: 'input',
      entry: '\u{1D49C}',
    });
  });

  it.each([' ', 'F5', 'Shift', 'Escape', 'Dead'])('ignores %j', (key) => {
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

  it.each([
    [{ key: 'z', ctrlKey: true }, 'undo'],
    [{ key: 'z', metaKey: true }, 'undo'],
    [{ key: 'Z', ctrlKey: true, shiftKey: true }, 'redo'],
    [{ key: 'z', metaKey: true, shiftKey: true }, 'redo'],
    [{ key: 'y', ctrlKey: true }, 'redo'],
  ])('maps %o to %s', (input, type) => {
    expect(keyToAction(input, 'grid')).toEqual({ type });
  });

  it('leaves other modifier combinations to the browser', () => {
    expect(keyToAction({ key: 'z', altKey: true, ctrlKey: true }, 'grid')).toBeNull();
    expect(keyToAction({ key: 'y', metaKey: true }, 'grid')).toBeNull();
  });
});
