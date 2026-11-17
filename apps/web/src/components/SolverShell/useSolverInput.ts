import {
  applyEdit,
  canRedo,
  canUndo,
  emptyHistory,
  getCell,
  noMarks,
  recordEdit,
  redo,
  undo,
  type CellEdit,
  type CellNumber,
  type MarkEdit,
  type Marks,
  type SolveState,
} from '@gridicles/core';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type RefObject,
} from 'react';
import { startComposition, syncComposition, type Composition } from './composition';
import type { EditToolsProps } from './EditTools';
import type { Cursor, SolverModel } from './model';
import { isBrowserShortcut, sharedKeyAction, type SharedAction } from './sharedKeys';
import type { SolverInputProps } from './SolverInput';
import { entriesFromText, entryFromEditBox } from './textInput';
import { useMultiLetter } from './useMultiLetter';

/**
 * Kept in the hidden input so phone keyboards always have something to
 * delete: without it, Backspace in an empty field sends no event on Android.
 */
export const SENTINEL = '​';

export interface SolverInputOptions<S extends Cursor, A> {
  readonly model: SolverModel<S, A>;
  readonly initialSelection: () => S;
  /** The letters to show. The solver doesn't own them; it reports edits instead. */
  readonly solve: SolveState;
  readonly onEdit: (edit: CellEdit) => void;
  /** Highlighted squares. Like letters, the solver reports changes instead of owning them. */
  readonly marks?: Marks | undefined;
  /** Toggle a highlight. Without it, there's no highlighting. */
  readonly onMark?: ((mark: MarkEdit) => void) | undefined;
  /** Called with the selected cell whenever the cursor moves. */
  readonly onSelectionChange?: ((cell: CellNumber) => void) | undefined;
}

export interface SolverInput<S extends Cursor, A> {
  readonly selection: S;
  /** The typing input has focus: keys go to the puzzle. */
  readonly focused: boolean;
  readonly multiLetterOn: boolean;
  readonly marks: Marks;
  /** Moves the cursor (e.g. a click) and readies typing. Saves any multi-letter text first. */
  readonly select: (next: S) => void;
  /** Runs one of the puzzle's own actions, as a key would. */
  readonly apply: (action: A) => void;
  /** Highlights a square for everyone, or removes its highlight. Stable across renders. */
  readonly toggleMark: (cell: CellNumber) => void;
  /** Put on the solver's outer element: the typing input is positioned inside it. */
  readonly rootRef: RefObject<HTMLDivElement | null>;
  readonly inputProps: SolverInputProps;
  readonly toolProps: EditToolsProps;
}

/**
 * The shared solving machinery, for any puzzle type.
 *
 * Typing goes through one hidden text input that sits on the selected square.
 * Tapping a square focuses it, so phones open their keyboard; text arrives as
 * input events, which also covers dead keys, IMEs, swipe typing and Android
 * keyboards that compose every word. Command keys go to the puzzle's model on
 * keydown. Also owns undo/redo of your own edits, highlights and multi-letter
 * mode, so every puzzle type gets them the same way.
 */
export function useSolverInput<S extends Cursor, A>({
  model,
  initialSelection,
  solve,
  onEdit,
  marks = noMarks,
  onMark,
  onSelectionChange,
}: SolverInputOptions<S, A>): SolverInput<S, A> {
  const [selection, setSelection] = useState(initialSelection);
  const [focused, setFocused] = useState(false);
  // Your own edits during this visit, for Undo/Redo. Others' edits never enter it.
  const [history, setHistory] = useState(emptyHistory);

  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Text the keyboard is still composing, already typed into the squares.
  const compositionRef = useRef<Composition<S> | null>(null);

  /** Empties the hidden input (bar the sentinel), keeping the caret at the end. */
  const resetInput = useCallback(() => {
    const input = inputRef.current;
    if (!input) return;
    input.value = SENTINEL;
    input.setSelectionRange(SENTINEL.length, SENTINEL.length);
  }, []);

  /** Stops treating the keyboard's composing text as live, e.g. when the cursor jumps. */
  const endComposition = useCallback(() => {
    if (!compositionRef.current) return;
    compositionRef.current = null;
    resetInput();
  }, [resetInput]);

  /** Sends your edit to the room and records it for Undo. */
  const emit = useCallback(
    (edit: CellEdit, before: SolveState) => {
      setHistory((h) => recordEdit(h, before, edit));
      onEdit(edit);
    },
    [onEdit],
  );

  // Read through a ref so toggleMark stays stable and highlights don't re-render memoized rows.
  const marking = useRef({ marks, onMark });
  useEffect(() => {
    marking.current = { marks, onMark };
  }, [marks, onMark]);
  const toggleMark = useCallback((cell: CellNumber) => {
    const { marks: current, onMark: report } = marking.current;
    report?.({ cell, marked: !current.has(cell) });
  }, []);

  /** Saves multi-letter mode's text as one edit. */
  const saveMultiLetter = useCallback(
    (text: string, advance: boolean) => {
      const value = entryFromEditBox(text);
      // The box's length limit and the keyboard can't produce invalid text; keep the square as it was.
      if (value === undefined) return;
      const result = model.save(solve, selection, value);
      if (result.edit) emit(result.edit, solve);
      if (advance) setSelection(result.selection);
    },
    [model, solve, selection, emit],
  );
  const {
    editing: multiLetterOn,
    isEditing: isMultiLetterOn,
    start: startMultiLetter,
    save: finishMultiLetter,
    cancel: cancelMultiLetter,
  } = useMultiLetter({
    inputRef,
    resetInput,
    currentEntry: getCell(solve, selection.cell),
    onSave: saveMultiLetter,
  });

  /** Undo or redo one of your edits, moving the cursor to the square it changed. */
  const step = useCallback(
    (which: 'undo' | 'redo') => {
      cancelMultiLetter();
      endComposition();
      const result = (which === 'undo' ? undo : redo)(history, solve);
      setHistory(result.history);
      const { edit } = result;
      if (!edit) return;
      onEdit(edit);
      setSelection((current) => ({ ...current, cell: edit.cell }));
    },
    [history, solve, onEdit, endComposition, cancelMultiLetter],
  );

  const applyShared = useCallback(
    (action: SharedAction) => {
      endComposition();
      switch (action.type) {
        case 'undo':
        case 'redo':
          step(action.type);
          return;
        case 'multiLetter':
          startMultiLetter();
          return;
        case 'mark':
          toggleMark(selection.cell);
          return;
      }
    },
    [endComposition, step, startMultiLetter, toggleMark, selection.cell],
  );

  const apply = useCallback(
    (action: A) => {
      endComposition();
      const result = model.apply(solve, selection, action);
      setSelection(result.selection);
      if (result.edit) emit(result.edit, solve);
    },
    [model, solve, selection, emit, endComposition],
  );

  /** Types each entry in turn, moving on like separate key presses. */
  const typeText = useCallback(
    (text: string) => {
      let current = selection;
      let state = solve;
      for (const entry of entriesFromText(text)) {
        const result = model.type(state, current, entry);
        if (result.edit) {
          emit(result.edit, state);
          state = applyEdit(state, result.edit);
        }
        current = result.selection;
      }
      setSelection(current);
    },
    [model, solve, selection, emit],
  );

  /** Shows the keyboard's latest composing text in the squares. */
  const compose = useCallback(
    (text: string) => {
      const composition = compositionRef.current ?? startComposition(selection);
      const result = syncComposition(model.type, solve, composition, text);
      let state = solve;
      for (const edit of result.edits) {
        emit(edit, state);
        state = applyEdit(state, edit);
      }
      compositionRef.current = result.composition;
      setSelection(result.selection);
    },
    [model, solve, selection, emit],
  );

  // Native listeners: React's onBeforeInput doesn't expose inputType (needed for deletes).
  const latest = useRef({
    applyShared,
    typeText,
    compose,
    isEditing: isMultiLetterOn,
    model,
    selection,
    apply,
  });
  useEffect(() => {
    latest.current = {
      applyShared,
      typeText,
      compose,
      isEditing: isMultiLetterOn,
      model,
      selection,
      apply,
    };
  }, [applyShared, typeText, compose, isMultiLetterOn, model, selection, apply]);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    /** A delete from an on-screen keyboard: Backspace or Delete as the puzzle maps them. */
    const deleteKey = (key: 'Backspace' | 'Delete') => {
      const { model: m, selection: s, apply: run } = latest.current;
      const action = m.keyToAction({ key }, s);
      if (action !== null) run(action);
    };
    // In multi-letter mode the input is a plain text box: let the browser edit it.
    const onBeforeInput = (event: InputEvent) => {
      if (latest.current.isEditing()) return;
      if (event.isComposing) return; // composing text is handled on input (below)
      if (event.inputType === 'historyUndo' || event.inputType === 'historyRedo') {
        // e.g. an Edit menu or shake-to-undo
        event.preventDefault();
        latest.current.applyShared({ type: event.inputType === 'historyUndo' ? 'undo' : 'redo' });
      } else if (event.inputType.startsWith('delete')) {
        event.preventDefault();
        deleteKey(event.inputType === 'deleteContentForward' ? 'Delete' : 'Backspace');
      } else if (event.inputType.startsWith('insert') && event.data) {
        event.preventDefault();
        latest.current.typeText(event.data);
      }
    };
    // Composing text is typed as it changes, not when composing ends: Android
    // keyboards compose every word, even plain letters, and may never end. The
    // input keeps the composing text until then, so the keyboard stays in step.
    const onInput = (event: Event) => {
      if (latest.current.isEditing()) return;
      if (event instanceof InputEvent && event.isComposing) {
        latest.current.compose(input.value.replace(SENTINEL, ''));
      } else {
        resetInput();
      }
    };
    const onCompositionEnd = (event: CompositionEvent) => {
      if (latest.current.isEditing()) return;
      latest.current.compose(event.data);
      compositionRef.current = null;
      queueMicrotask(resetInput);
    };
    resetInput();
    input.addEventListener('beforeinput', onBeforeInput);
    input.addEventListener('compositionend', onCompositionEnd);
    input.addEventListener('input', onInput);
    return () => {
      input.removeEventListener('beforeinput', onBeforeInput);
      input.removeEventListener('compositionend', onCompositionEnd);
      input.removeEventListener('input', onInput);
    };
  }, [resetInput]);

  // Keep the selected square visible, and the hidden input on top of it (so phones
  // scroll to it and IME suggestion windows appear next to it).
  const targetId = model.targetId(selection);
  useEffect(() => {
    const target = document.getElementById(targetId);
    target?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    const root = rootRef.current;
    const input = inputRef.current;
    if (target && root && input) {
      const t = target.getBoundingClientRect();
      const r = root.getBoundingClientRect();
      input.style.transform = `translate(${t.left - r.left}px, ${t.top - r.top}px)`;
      // The multi-letter edit box covers the square (see .editing).
      input.style.setProperty('--target-width', `${t.width}px`);
      input.style.setProperty('--target-height', `${t.height}px`);
    }
  }, [targetId]);

  useEffect(() => {
    onSelectionChange?.(selection.cell);
  }, [selection.cell, onSelectionChange]);

  /** In multi-letter mode, only saving and cancelling keys are ours; the rest edit the text. */
  const onEditBoxKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      cancelMultiLetter();
    } else if (event.key === 'Enter' || event.key === 'Tab' || event.key === 'Insert') {
      event.preventDefault();
      finishMultiLetter(true);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing || event.key === 'Process') return;
    if (multiLetterOn) {
      onEditBoxKeyDown(event);
      return;
    }
    const shared = sharedKeyAction(event);
    if (shared) {
      event.preventDefault();
      applyShared(shared);
      return;
    }
    if (isBrowserShortcut(event)) return;
    // Tab out of the solver at the ends, so keyboard users are never trapped.
    if (model.leaves(event, selection)) return;
    const action = model.keyToAction(event, selection);
    if (action === null) return;
    event.preventDefault();
    apply(action);
  };

  const select = useCallback(
    (next: S) => {
      finishMultiLetter(false);
      endComposition();
      setSelection(next);
      inputRef.current?.focus({ preventScroll: true });
    },
    [endComposition, finishMultiLetter],
  );

  return {
    selection,
    focused,
    multiLetterOn,
    marks,
    select,
    apply,
    toggleMark,
    rootRef,
    inputProps: {
      inputRef,
      editing: multiLetterOn,
      onKeyDown,
      onFocus: () => setFocused(true),
      onBlur: () => {
        setFocused(false);
        // Clicking elsewhere keeps what was typed.
        finishMultiLetter(false);
      },
    },
    toolProps: {
      canUndo: canUndo(history, solve),
      canRedo: canRedo(history, solve),
      onUndo: () => step('undo'),
      onRedo: () => step('redo'),
      multiLetter: multiLetterOn,
      onMultiLetter: () => (multiLetterOn ? finishMultiLetter(true) : startMultiLetter()),
      marked: onMark ? marks.has(selection.cell) : null,
      onMark: () => toggleMark(selection.cell),
    },
  };
}
