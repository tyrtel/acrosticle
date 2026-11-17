import type { CellEdit, CellNumber, Entry, SolveState } from '@gridicles/core';

/** Any puzzle's cursor: at least the selected cell. */
export interface Cursor {
  readonly cell: CellNumber;
}

/** Where the cursor goes, and the edit (if any) to send to the room. */
export interface Move<S extends Cursor> {
  readonly selection: S;
  readonly edit: CellEdit | null;
}

/** The parts of a keyboard event a keymap needs (easy to build in tests). */
export interface KeyInput {
  readonly key: string;
  readonly shiftKey?: boolean;
  readonly ctrlKey?: boolean;
  readonly metaKey?: boolean;
  readonly altKey?: boolean;
}

/**
 * What a puzzle type tells the shared solver shell: how its cursor moves.
 * Everything else (typing, phone keyboards, multi-letter mode, undo,
 * highlights, focus) is the shell's job, the same for every puzzle type.
 */
export interface SolverModel<S extends Cursor, A> {
  /** Typing one entry at the cursor: a key, IME text, or one character of a paste. */
  readonly type: (solve: SolveState, selection: S, entry: Entry) => Move<S>;
  /** Saving multi-letter mode: an entry moves on like typing; null clears the square in place. */
  readonly save: (solve: SolveState, selection: S, value: Entry | null) => Move<S>;
  /**
   * What a key does in this puzzle, or null to leave it alone. Characters
   * normally return null: they arrive as input events. Shared keys (undo,
   * redo, highlight, multi-letter) are the shell's and never get here.
   */
  readonly keyToAction: (input: KeyInput, selection: S) => A | null;
  readonly apply: (solve: SolveState, selection: S, action: A) => Move<S>;
  /** Whether a key should leave the solver (e.g. Tab past the last clue), so keyboard users aren't trapped. */
  readonly leaves: (input: KeyInput, selection: S) => boolean;
  /** The id of the element the typing input sits on (the selected square or blank). */
  readonly targetId: (selection: S) => string;
}
