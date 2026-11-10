import { describe, expect, it } from 'vitest';
import type { Entry } from './entries';
import {
  canRedo,
  canUndo,
  emptyHistory,
  MAX_HISTORY,
  recordEdit,
  redo,
  undo,
  type EditHistory,
} from './history';
import { applyEdit, emptySolveState, setCell, type CellEdit, type SolveState } from './solveState';

const E = (s: string) => s as Entry;

/** Plays edits as "you", returning the state and history. */
function play(edits: CellEdit[], start: SolveState = emptySolveState) {
  let state = start;
  let history: EditHistory = emptyHistory;
  for (const edit of edits) {
    history = recordEdit(history, state, edit);
    state = applyEdit(state, edit);
  }
  return { state, history };
}

describe('undo / redo', () => {
  it('undoes your edits newest first, restoring what was there', () => {
    const start = setCell(emptySolveState, 2, E('q'));
    const { state, history } = play(
      [
        { cell: 1, value: E('A') },
        { cell: 2, value: E('B') },
      ],
      start,
    );

    const first = undo(history, state);
    expect(first.edit).toEqual({ cell: 2, value: 'q' });
    const afterFirst = applyEdit(state, first.edit);

    const second = undo(first.history, afterFirst);
    expect(second.edit).toEqual({ cell: 1, value: null });
    expect(undo(second.history, applyEdit(afterFirst, second.edit)).edit).toBeNull();
  });

  it('redoes what was undone, and a new edit clears redo', () => {
    const { state, history } = play([{ cell: 1, value: E('A') }]);
    const undone = undo(history, state);
    const afterUndo = applyEdit(state, undone.edit);
    expect(canRedo(undone.history, afterUndo)).toBe(true);

    const redone = redo(undone.history, afterUndo);
    expect(redone.edit).toEqual({ cell: 1, value: 'A' });
    expect(canUndo(redone.history, applyEdit(afterUndo, redone.edit))).toBe(true);

    const newEdit = recordEdit(undone.history, afterUndo, { cell: 3, value: E('Z') });
    expect(newEdit.redo).toEqual([]);
  });

  it('skips steps whose square someone else has changed since', () => {
    const { state, history } = play([
      { cell: 1, value: E('A') },
      { cell: 2, value: E('B') },
    ]);
    const collaborator = setCell(state, 2, E('X')); // someone overwrote your B

    expect(canUndo(history, collaborator)).toBe(true);
    const result = undo(history, collaborator);
    expect(result.edit).toEqual({ cell: 1, value: null }); // B's step was skipped
    expect(result.history.undo).toEqual([]);
  });

  it('reports nothing to undo when every step was overwritten', () => {
    const { state, history } = play([{ cell: 1, value: E('A') }]);
    const collaborator = setCell(state, 1, null);
    expect(canUndo(history, collaborator)).toBe(false);
    expect(undo(history, collaborator)).toEqual({ history: emptyHistory, edit: null });
  });

  it('skips redo steps whose square changed after the undo', () => {
    const { state, history } = play([{ cell: 1, value: E('A') }]);
    const undone = undo(history, state);
    const collaborator = setCell(applyEdit(state, undone.edit), 1, E('Y'));
    expect(canRedo(undone.history, collaborator)).toBe(false);
    expect(redo(undone.history, collaborator).edit).toBeNull();
  });

  it("doesn't record edits that change nothing", () => {
    const start = setCell(emptySolveState, 1, E('A'));
    expect(recordEdit(emptyHistory, start, { cell: 1, value: E('A') })).toBe(emptyHistory);
  });

  it(`keeps at most ${MAX_HISTORY} steps`, () => {
    const edits = Array.from({ length: MAX_HISTORY + 5 }, (_, i) => ({
      cell: (i % 50) + 1,
      // Revisits of a square always bring a different letter, so every edit counts.
      value: E(String.fromCharCode(65 + (i % 26))),
    }));
    expect(play(edits).history.undo).toHaveLength(MAX_HISTORY);
  });
});
