import type { ButtonHTMLAttributes, ReactNode } from 'react';
import styles from './SolverShell.module.css';

const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

export interface EditToolsProps {
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly onUndo: () => void;
  readonly onRedo: () => void;
  /** Multi-letter mode is on. */
  readonly multiLetter: boolean;
  readonly onMultiLetter: () => void;
  /** Whether the selected square is highlighted, or null when highlighting isn't available. */
  readonly marked: boolean | null;
  readonly onMark: () => void;
}

/** A toolbar button that doesn't take focus, so typing continues after a click. */
export function ToolButton(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" onMouseDown={(event) => event.preventDefault()} {...props} />;
}

/** Undo, Redo, Multi-letter and Highlight, plus any puzzle-specific tools after them. */
export function EditTools({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  multiLetter,
  onMultiLetter,
  marked,
  onMark,
  children,
}: EditToolsProps & { readonly children?: ReactNode }) {
  const undoKeys = IS_MAC ? '⌘Z' : 'Ctrl+Z';
  const redoKeys = IS_MAC ? '⇧⌘Z' : 'Ctrl+Y';
  return (
    <div className={styles.toolbar} role="toolbar" aria-label="Editing">
      <ToolButton
        onClick={onUndo}
        disabled={!canUndo}
        title={`Undo your last change (${undoKeys})`}
        aria-keyshortcuts="Control+Z Meta+Z"
      >
        <span aria-hidden="true">↶</span> Undo
      </ToolButton>
      <ToolButton
        onClick={onRedo}
        disabled={!canRedo}
        title={`Redo (${redoKeys})`}
        aria-keyshortcuts="Control+Shift+Z Meta+Shift+Z Control+Y"
      >
        <span aria-hidden="true">↷</span> Redo
      </ToolButton>
      <ToolButton
        onClick={onMultiLetter}
        aria-pressed={multiLetter}
        title={
          multiLetter
            ? 'Save the letters in this square (Enter)'
            : 'Type several letters in this square (Shift+Enter or Insert)'
        }
        aria-keyshortcuts="Shift+Enter Insert"
      >
        Multi-letter
      </ToolButton>
      {marked !== null && (
        <ToolButton
          className={styles.markButton}
          onClick={onMark}
          aria-pressed={marked}
          title={`${marked ? 'Remove the highlight from' : 'Highlight'} this square for everyone (Ctrl+H, or ${IS_MAC ? '⌘' : 'Ctrl'}+click any square)`}
          aria-keyshortcuts="Control+H"
        >
          Highlight
        </ToolButton>
      )}
      {children}
    </div>
  );
}
