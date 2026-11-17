import type { Arrow } from '@gridicles/crossword';
import type { KeyInput } from '../../components/SolverShell';

/** What a key does in a crossword (the shell handles the keys every puzzle shares). */
export type CrosswordAction =
  | { readonly type: 'arrow'; readonly arrow: Arrow }
  | { readonly type: 'erase' }
  | { readonly type: 'clear' }
  | { readonly type: 'toggle' }
  | { readonly type: 'jump'; readonly delta: 1 | -1 };

const ARROWS: Readonly<Record<string, Arrow>> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
};

/**
 * | Key            | Does                                                                   |
 * | -------------- | ---------------------------------------------------------------------- |
 * | Arrows         | along the direction: move one square; across it: switch direction      |
 * | Space, Enter   | switch between across and down                                         |
 * | Tab / ⇧Tab     | next / previous clue (Across, then Down)                               |
 * | Backspace      | clear, or step back in the word and clear                              |
 * | Delete         | clear in place                                                         |
 *
 * Other characters arrive as input events, so they're left alone here.
 */
export function keyToCrosswordAction(input: KeyInput): CrosswordAction | null {
  if (input.ctrlKey || input.metaKey || input.altKey) return null;
  const arrow = ARROWS[input.key];
  if (arrow) return { type: 'arrow', arrow };
  switch (input.key) {
    case ' ':
      return { type: 'toggle' };
    case 'Enter':
      return input.shiftKey ? null : { type: 'toggle' };
    case 'Tab':
      return { type: 'jump', delta: input.shiftKey ? -1 : 1 };
    case 'Backspace':
      return { type: 'erase' };
    case 'Delete':
      return { type: 'clear' };
    default:
      return null;
  }
}
