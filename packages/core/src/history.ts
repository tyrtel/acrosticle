import type { Entry } from './entries';
import type { CellNumber } from './puzzle';
import { getCell, type CellEdit, type SolveState } from './solveState';

/** One of your own edits: what a square held before, and what you put there. */
export interface HistoryStep {
  readonly cell: CellNumber;
  readonly before: Entry | null;
  readonly after: Entry | null;
}

/** Your undo and redo stacks for one visit to a room. The last item is the most recent. */
export interface EditHistory {
  readonly undo: readonly HistoryStep[];
  readonly redo: readonly HistoryStep[];
}

export const emptyHistory: EditHistory = { undo: [], redo: [] };

/** Older steps are dropped beyond this. */
export const MAX_HISTORY = 500;

/** Records an edit you made (call with the state from just before it). Clears redo. */
export function recordEdit(history: EditHistory, before: SolveState, edit: CellEdit): EditHistory {
  const was = getCell(before, edit.cell);
  if (was === edit.value) return history;
  const undo = [...history.undo, { cell: edit.cell, before: was, after: edit.value }];
  return { undo: undo.slice(-MAX_HISTORY), redo: [] };
}

export interface HistoryMove {
  readonly history: EditHistory;
  /** The edit to send, or null if there was nothing (left) to undo or redo. */
  readonly edit: CellEdit | null;
}

/**
 * Reverts your most recent edit that's still showing. Steps whose square has
 * since been changed by someone else are skipped (and dropped), so undo never
 * erases a collaborator's work.
 */
export function undo(history: EditHistory, current: SolveState): HistoryMove {
  return move(history.undo, history.redo, current, 'after', 'before', (rest, other) => ({
    undo: rest,
    redo: other,
  }));
}

/** Re-applies your most recently undone edit, if its square is still as undo left it. */
export function redo(history: EditHistory, current: SolveState): HistoryMove {
  return move(history.redo, history.undo, current, 'before', 'after', (rest, other) => ({
    undo: other,
    redo: rest,
  }));
}

/** Whether `undo` would change anything right now. */
export function canUndo(history: EditHistory, current: SolveState): boolean {
  return history.undo.some((step) => getCell(current, step.cell) === step.after);
}

/** Whether `redo` would change anything right now. */
export function canRedo(history: EditHistory, current: SolveState): boolean {
  return history.redo.some((step) => getCell(current, step.cell) === step.before);
}

function move(
  from: readonly HistoryStep[],
  to: readonly HistoryStep[],
  current: SolveState,
  expect: 'before' | 'after',
  restore: 'before' | 'after',
  build: (from: readonly HistoryStep[], to: readonly HistoryStep[]) => EditHistory,
): HistoryMove {
  const remaining = [...from];
  for (let step = remaining.pop(); step; step = remaining.pop()) {
    if (getCell(current, step.cell) === step[expect]) {
      return {
        history: build(remaining, [...to, step]),
        edit: { cell: step.cell, value: step[restore] },
      };
    }
    // Someone else changed this square since: skip the step.
  }
  return { history: build([], to), edit: null };
}
