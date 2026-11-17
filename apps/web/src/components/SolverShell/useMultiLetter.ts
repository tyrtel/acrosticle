import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

export interface MultiLetterOptions {
  readonly inputRef: RefObject<HTMLInputElement | null>;
  /** Puts the input back to its everyday (hidden, single-character) state. */
  readonly resetInput: () => void;
  /** What the selected square holds now, to start editing from. */
  readonly currentEntry: string | null;
  /** Called with the edit box's text when it's saved. */
  readonly onSave: (text: string, advance: boolean) => void;
}

export interface MultiLetter {
  readonly editing: boolean;
  /** Read by native event listeners, which can't wait for a re-render. */
  readonly isEditing: () => boolean;
  /** Turns the solver's input into a visible edit box holding the square's entry. */
  readonly start: () => void;
  /** Saves the box's text; `advance` moves the cursor on, as typing a letter does. */
  readonly save: (advance: boolean) => void;
  /** Leaves the square as it was. */
  readonly cancel: () => void;
}

/**
 * Multi-letter mode: one square gets several characters, typed into a real
 * text box (so caret keys, paste, phone keyboards and IMEs work natively),
 * then saved as one edit. See F5 in docs/planning/features.md.
 */
export function useMultiLetter(options: MultiLetterOptions): MultiLetter {
  const [editing, setEditing] = useState(false);
  const editingRef = useRef(false);
  // The functions below stay the same across renders (so memoized children
  // don't re-render), reading the latest options from here.
  const latest = useRef(options);
  useEffect(() => {
    latest.current = options;
  });

  const switchTo = useCallback((on: boolean) => {
    editingRef.current = on;
    setEditing(on);
  }, []);

  const isEditing = useCallback(() => editingRef.current, []);

  const start = useCallback(() => {
    const input = latest.current.inputRef.current;
    if (!input || editingRef.current) return;
    switchTo(true);
    input.value = latest.current.currentEntry ?? '';
    input.setSelectionRange(input.value.length, input.value.length);
    input.focus({ preventScroll: true });
  }, [switchTo]);

  const finish = useCallback(
    (outcome: { save: false } | { save: true; advance: boolean }) => {
      const { inputRef, resetInput, onSave } = latest.current;
      const input = inputRef.current;
      if (!input || !editingRef.current) return;
      const text = input.value;
      switchTo(false);
      resetInput();
      if (outcome.save) onSave(text, outcome.advance);
    },
    [switchTo],
  );

  const save = useCallback((advance: boolean) => finish({ save: true, advance }), [finish]);
  const cancel = useCallback(() => finish({ save: false }), [finish]);

  return { editing, isEditing, start, save, cancel };
}
