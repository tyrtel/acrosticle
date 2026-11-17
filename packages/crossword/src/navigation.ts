import {
  applyEdit,
  getCell,
  type CellEdit,
  type CellNumber,
  type Entry,
  type SolveState,
} from '@gridicles/core';
import type { CrosswordIndex, Word } from './crosswordIndex';
import type { Direction } from './puzzle';

/** The crossword cursor: a square, and whether typing runs across or down. */
export interface CrosswordSelection {
  readonly cell: CellNumber;
  readonly direction: Direction;
}

/** What an action does: an optional change to one cell, and where the cursor goes. */
export interface CrosswordMove {
  readonly edit: CellEdit | null;
  readonly selection: CrosswordSelection;
}

export type Arrow = 'up' | 'down' | 'left' | 'right';

const other = (direction: Direction): Direction => (direction === 'across' ? 'down' : 'across');
const stay = (selection: CrosswordSelection): CrosswordMove => ({ edit: null, selection });

/** Starts on the first across word (or the first down word if there are no across words). */
export function initialCrosswordSelection(index: CrosswordIndex): CrosswordSelection {
  const across = index.words('across')[0];
  if (across?.cells[0] !== undefined) return { cell: across.cells[0], direction: 'across' };
  const down = index.words('down')[0];
  if (down?.cells[0] !== undefined) return { cell: down.cells[0], direction: 'down' };
  // A stylized grid with no proper words: start on any open square.
  const first = index.cells[0];
  if (first !== undefined) return { cell: first, direction: 'across' };
  throw new Error('Crossword has no open squares');
}

/**
 * The word the cursor is typing in. A square in only one word (an unchecked
 * square) has a word in only one direction; then that's the one.
 */
export function currentWord(
  index: CrosswordIndex,
  selection: CrosswordSelection,
): Word | undefined {
  return (
    index.wordOf(selection.cell, selection.direction) ??
    index.wordOf(selection.cell, other(selection.direction))
  );
}

/** Switches across ↔ down, if the square has a word the other way. */
export function toggleDirection(
  index: CrosswordIndex,
  selection: CrosswordSelection,
): CrosswordSelection {
  const flipped = other(selection.direction);
  return index.wordOf(selection.cell, flipped) ? { ...selection, direction: flipped } : selection;
}

/**
 * Clicking a square: selecting it again switches direction; a new square keeps
 * the direction, unless the square has no word that way.
 */
export function clickSquare(
  index: CrosswordIndex,
  selection: CrosswordSelection,
  cell: CellNumber,
): CrosswordSelection {
  if (cell === selection.cell) return toggleDirection(index, selection);
  return toggleIfNoWord(index, { cell, direction: selection.direction });
}

/** Typing an entry: writes it, then moves on in the word (see `moveOn`). */
export function typeInCrossword(
  index: CrosswordIndex,
  solve: SolveState,
  selection: CrosswordSelection,
  entry: Entry,
): CrosswordMove {
  const edit: CellEdit = { cell: selection.cell, value: entry };
  return { edit, selection: moveOn(index, applyEdit(solve, edit), selection) };
}

/**
 * Saving a multi-letter entry moves on like typing; saving it empty clears the
 * square in place. Unchanged values send no edit.
 */
export function saveInCrossword(
  index: CrosswordIndex,
  solve: SolveState,
  selection: CrosswordSelection,
  value: Entry | null,
): CrosswordMove {
  const changed = getCell(solve, selection.cell) !== value;
  if (value === null)
    return { edit: changed ? { cell: selection.cell, value: null } : null, selection };
  const typed = typeInCrossword(index, solve, selection, value);
  return changed ? typed : { ...typed, edit: null };
}

/**
 * Where the cursor goes after typing: the next empty square later in the word,
 * or the word's last square if none is empty. On the last square it stays: it
 * never jumps to the next clue.
 */
function moveOn(
  index: CrosswordIndex,
  solve: SolveState,
  selection: CrosswordSelection,
): CrosswordSelection {
  const word = currentWord(index, selection);
  if (!word) return selection;
  const position = word.cells.indexOf(selection.cell);
  const later = word.cells.slice(position + 1);
  const target = later.find((cell) => getCell(solve, cell) === null) ?? later.at(-1);
  return target === undefined ? selection : { cell: target, direction: word.direction };
}

/** Backspace: clears the square; on an empty square, steps back one in the word and clears that. */
export function eraseInCrossword(
  index: CrosswordIndex,
  solve: SolveState,
  selection: CrosswordSelection,
): CrosswordMove {
  if (getCell(solve, selection.cell) !== null) {
    return { edit: { cell: selection.cell, value: null }, selection };
  }
  const word = currentWord(index, selection);
  const previous = word?.cells[word.cells.indexOf(selection.cell) - 1];
  if (previous === undefined || !word) return stay(selection);
  const back = { cell: previous, direction: word.direction };
  return {
    edit: getCell(solve, previous) === null ? null : { cell: previous, value: null },
    selection: back,
  };
}

/**
 * Arrow keys. An arrow across the typing direction switches direction without
 * moving (if the square has a word that way). Otherwise it moves exactly one
 * square, filled or empty, stepping over black squares; at the edge it stays.
 */
export function arrowInCrossword(
  index: CrosswordIndex,
  selection: CrosswordSelection,
  arrow: Arrow,
): CrosswordSelection {
  const axis: Direction = arrow === 'left' || arrow === 'right' ? 'across' : 'down';
  if (axis !== selection.direction && index.wordOf(selection.cell, axis)) {
    return { ...selection, direction: axis };
  }
  const dRow = arrow === 'up' ? -1 : arrow === 'down' ? 1 : 0;
  const dColumn = arrow === 'left' ? -1 : arrow === 'right' ? 1 : 0;
  let { row, column } = index.positionOf(selection.cell);
  for (;;) {
    row += dRow;
    column += dColumn;
    const cell = index.cellAt(row, column);
    if (cell === undefined) return selection;
    if (index.isOpen(cell)) return toggleIfNoWord(index, { ...selection, cell });
  }
}

/** All words in Tab order: Across by number, then Down. */
export function tabOrder(index: CrosswordIndex): readonly Word[] {
  return [...index.words('across'), ...index.words('down')];
}

/**
 * Tab / Shift+Tab: the next or previous clue, in Tab order, landing on its
 * first empty square. Stays put past either end (the solver lets Tab leave).
 */
export function jumpInCrossword(
  index: CrosswordIndex,
  solve: SolveState,
  selection: CrosswordSelection,
  delta: 1 | -1,
): CrosswordSelection {
  const order = tabOrder(index);
  const word = currentWord(index, selection);
  const target = word ? order[order.indexOf(word) + delta] : undefined;
  return target ? enterWord(solve, target) : selection;
}

/** Whether Tab / Shift+Tab would go past the last / first clue. */
export function atTabEnd(
  index: CrosswordIndex,
  selection: CrosswordSelection,
  delta: 1 | -1,
): boolean {
  const order = tabOrder(index);
  const word = currentWord(index, selection);
  const position = word ? order.indexOf(word) : -1;
  return delta === 1 ? position === order.length - 1 : position === 0;
}

/** Clicking a clue (or tabbing to it): its first empty square, or its first square if it's full. */
export function enterWord(solve: SolveState, word: Word): CrosswordSelection {
  const cell = word.cells.find((c) => getCell(solve, c) === null) ?? word.cells[0];
  if (cell === undefined) throw new Error(`${word.number} ${word.direction} has no squares`);
  return { cell, direction: word.direction };
}

function toggleIfNoWord(index: CrosswordIndex, selection: CrosswordSelection): CrosswordSelection {
  return index.wordOf(selection.cell, selection.direction)
    ? selection
    : toggleDirection(index, selection);
}
