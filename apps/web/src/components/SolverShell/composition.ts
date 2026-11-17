import { applyEdit, getCell, type CellEdit, type Entry, type SolveState } from '@gridicles/core';
import type { Cursor, SolverModel } from './model';
import { entriesFromText } from './textInput';

/** One entry typed from the composing text, and how to take it back. */
interface TypedEntry<S extends Cursor> {
  readonly entry: Entry;
  readonly edit: CellEdit | null;
  /** What the square held before. */
  readonly before: Entry | null;
  /** The cursor after typing it. */
  readonly after: S;
}

/**
 * Text a keyboard is still composing, already shown in the squares.
 *
 * Android keyboards (Samsung, Gboard) compose whole words even for plain
 * letters, and may never finish, so the solver types the composing text as it
 * changes instead of waiting for the end.
 */
export interface Composition<S extends Cursor> {
  /** The cursor when composing began. */
  readonly start: S;
  readonly typed: readonly TypedEntry<S>[];
}

export function startComposition<S extends Cursor>(selection: S): Composition<S> {
  return { start: selection, typed: [] };
}

/** What syncing the composing text changes. */
export interface CompositionSync<S extends Cursor> {
  readonly composition: Composition<S>;
  /** Edits to send, in order. */
  readonly edits: readonly CellEdit[];
  readonly selection: S;
}

/**
 * Brings the squares in line with the keyboard's latest composing text: keeps
 * the entries that still match, puts back what the rest overwrote, and types
 * the new ones (so "k" then "か", or a shrinking word, end up right).
 */
export function syncComposition<S extends Cursor>(
  type: SolverModel<S, unknown>['type'],
  solve: SolveState,
  composition: Composition<S>,
  text: string,
): CompositionSync<S> {
  const next = entriesFromText(text);
  const kept = matchingPrefix(composition.typed, next);
  const edits: CellEdit[] = [];
  let state = solve;
  const send = (edit: CellEdit) => {
    edits.push(edit);
    state = applyEdit(state, edit);
  };

  for (const typed of composition.typed.slice(kept).reverse()) {
    if (typed.edit && getCell(state, typed.edit.cell) !== typed.before) {
      send({ cell: typed.edit.cell, value: typed.before });
    }
  }

  const typed = composition.typed.slice(0, kept);
  let selection = typed.at(-1)?.after ?? composition.start;
  for (const entry of next.slice(kept)) {
    const result = type(state, selection, entry);
    const before = result.edit ? getCell(state, result.edit.cell) : null;
    if (result.edit) send(result.edit);
    selection = result.selection;
    typed.push({ entry, edit: result.edit, before, after: selection });
  }

  return { composition: { start: composition.start, typed }, edits, selection };
}

function matchingPrefix<S extends Cursor>(
  typed: readonly TypedEntry<S>[],
  next: readonly Entry[],
): number {
  let i = 0;
  while (i < typed.length && i < next.length && typed[i]?.entry === next[i]) i++;
  return i;
}
