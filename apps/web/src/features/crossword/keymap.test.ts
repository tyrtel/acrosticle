import { describe, expect, it } from 'vitest';
import { keyToCrosswordAction } from './keymap';

describe('keyToCrosswordAction', () => {
  it.each([
    [{ key: 'ArrowUp' }, { type: 'arrow', arrow: 'up' }],
    [{ key: 'ArrowRight' }, { type: 'arrow', arrow: 'right' }],
    [{ key: ' ' }, { type: 'toggle' }],
    [{ key: 'Enter' }, { type: 'toggle' }],
    [{ key: 'Tab' }, { type: 'jump', delta: 1 }],
    [
      { key: 'Tab', shiftKey: true },
      { type: 'jump', delta: -1 },
    ],
    [{ key: 'Backspace' }, { type: 'erase' }],
    [{ key: 'Delete' }, { type: 'clear' }],
  ])('maps %o', (input, action) => {
    expect(keyToCrosswordAction(input)).toEqual(action);
  });

  it.each([
    { key: 'a' },
    { key: 'Enter', shiftKey: true },
    { key: 'Insert' },
    { key: 'ArrowUp', ctrlKey: true },
    { key: ' ', altKey: true },
  ])('leaves %o to input events, the shell or the browser', (input) => {
    expect(keyToCrosswordAction(input)).toBeNull();
  });
});
