import { MAX_ENTRY_LENGTH } from '@gridicles/core';
import type { FocusEventHandler, KeyboardEventHandler, RefObject } from 'react';
import styles from './SolverShell.module.css';
import { SENTINEL } from './useSolverInput';

export interface SolverInputProps {
  readonly inputRef: RefObject<HTMLInputElement | null>;
  /** Multi-letter mode: shown as a text box over the square. */
  readonly editing: boolean;
  readonly onKeyDown: KeyboardEventHandler<HTMLInputElement>;
  readonly onFocus: FocusEventHandler<HTMLInputElement>;
  readonly onBlur: FocusEventHandler<HTMLInputElement>;
}

/**
 * The one text input all typing goes through (see useSolverInput). Hidden on
 * the selected square, or a visible edit box in multi-letter mode.
 * `describedBy` names the live region saying where the cursor is.
 */
export function SolverInput({
  inputRef,
  editing,
  onKeyDown,
  onFocus,
  onBlur,
  describedBy,
}: SolverInputProps & { readonly describedBy: string }) {
  return (
    <input
      ref={inputRef}
      className={editing ? `${styles.input} ${styles.editing}` : styles.input}
      aria-label={editing ? 'Multi-letter entry' : 'Answer entry'}
      aria-describedby={describedBy}
      defaultValue={SENTINEL}
      autoComplete="off"
      autoCorrect="off"
      autoCapitalize="off"
      spellCheck={false}
      maxLength={editing ? MAX_ENTRY_LENGTH : undefined}
      enterKeyHint={editing ? 'done' : 'next'}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      onBlur={onBlur}
    />
  );
}
