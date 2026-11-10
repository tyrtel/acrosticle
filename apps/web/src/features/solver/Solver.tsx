import {
  applyEdit,
  buildPuzzleIndex,
  canRedo,
  canUndo,
  describeSelection,
  emptyHistory,
  recordEdit,
  redo,
  undo,
  type CellEdit,
  type CellNumber,
  type Puzzle,
  type SolveState,
} from '@acrosticle/core';
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import type { PeerMap } from '../../components/PeerTag';
import { AcrosticBar } from './AcrosticBar';
import { ClueList } from './ClueList';
import { clueBlankId, gridSquareId } from './elementIds';
import { Grid } from './Grid';
import { keyToAction, type KeyAction } from './keymap';
import styles from './Solver.module.css';
import { initialSelection, reduceSolver } from './solverReducer';
import { entriesFromText } from './textInput';

const NO_PEERS: PeerMap = new Map();

/**
 * Kept in the hidden input so phone keyboards always have something to
 * delete: without it, Backspace in an empty field sends no event on Android.
 */
const SENTINEL = '​';

export interface SolverProps {
  /** A puzzle that passes `validatePuzzle` without errors. */
  readonly puzzle: Puzzle;
  /** The letters to show. The solver doesn't own them; it reports edits instead. */
  readonly solve: SolveState;
  readonly onEdit: (edit: CellEdit) => void;
  /** Other solvers' cursors. */
  readonly peers?: PeerMap;
  /** Called with the selected cell whenever the cursor moves. */
  readonly onSelectionChange?: (cell: CellNumber) => void;
}

/**
 * The solving screen: grid and clues, kept in sync. Owns only the cursor.
 *
 * Typing goes through one hidden text input that sits on the selected square.
 * Tapping a square focuses it, so phones open their keyboard; text arrives as
 * input events, which also covers dead keys, IMEs and swipe typing. Command
 * keys (arrows, Tab, Enter, Backspace, Delete) are handled on keydown.
 */
export function Solver({
  puzzle,
  solve,
  onEdit,
  peers = NO_PEERS,
  onSelectionChange,
}: SolverProps) {
  const index = useMemo(() => buildPuzzleIndex(puzzle), [puzzle]);
  const [selection, setSelection] = useState(() => initialSelection(index));
  const [focused, setFocused] = useState(false);
  // Your own edits during this visit, for Undo/Redo. Others' edits never enter it.
  const [history, setHistory] = useState(emptyHistory);
  const context = describeSelection(index, selection);

  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  /** Sends your edit to the room and records it for Undo. */
  const emit = useCallback(
    (edit: CellEdit, before: SolveState) => {
      setHistory((h) => recordEdit(h, before, edit));
      onEdit(edit);
    },
    [onEdit],
  );

  /** Undo or redo one of your edits, moving the cursor to the square it changed. */
  const step = useCallback(
    (which: 'undo' | 'redo') => {
      const result = (which === 'undo' ? undo : redo)(history, solve);
      setHistory(result.history);
      const { edit } = result;
      if (!edit) return;
      onEdit(edit);
      setSelection((current) => ({ ...current, cell: edit.cell }));
    },
    [history, solve, onEdit],
  );

  const apply = useCallback(
    (action: KeyAction) => {
      if (action.type === 'undo' || action.type === 'redo') {
        step(action.type);
        return;
      }
      const result = reduceSolver(index, solve, selection, action);
      setSelection(result.selection);
      if (result.edit) emit(result.edit, solve);
    },
    [index, solve, selection, emit, step],
  );

  /** Types each entry in turn, advancing like separate key presses. */
  const typeText = useCallback(
    (text: string) => {
      let current = selection;
      let state = solve;
      for (const entry of entriesFromText(text)) {
        const result = reduceSolver(index, state, current, { type: 'input', entry });
        if (result.edit) {
          emit(result.edit, state);
          state = applyEdit(state, result.edit);
        }
        current = result.selection;
      }
      setSelection(current);
    },
    [index, solve, selection, emit],
  );

  // Native listeners: React's onBeforeInput doesn't expose inputType (needed for deletes).
  const latest = useRef({ apply, typeText });
  useEffect(() => {
    latest.current = { apply, typeText };
  }, [apply, typeText]);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    const reset = () => {
      input.value = SENTINEL;
      input.setSelectionRange(SENTINEL.length, SENTINEL.length);
    };
    const onBeforeInput = (event: InputEvent) => {
      if (event.isComposing) return; // the IME is still composing; wait for compositionend
      if (event.inputType === 'historyUndo' || event.inputType === 'historyRedo') {
        // e.g. an Edit menu or shake-to-undo
        event.preventDefault();
        latest.current.apply({ type: event.inputType === 'historyUndo' ? 'undo' : 'redo' });
      } else if (event.inputType.startsWith('delete')) {
        event.preventDefault();
        latest.current.apply({
          type: event.inputType === 'deleteContentForward' ? 'clear' : 'erase',
        });
      } else if (event.inputType.startsWith('insert') && event.data) {
        event.preventDefault();
        latest.current.typeText(event.data);
      }
    };
    const onCompositionEnd = (event: CompositionEvent) => {
      latest.current.typeText(event.data);
      queueMicrotask(reset);
    };
    reset();
    input.addEventListener('beforeinput', onBeforeInput);
    input.addEventListener('compositionend', onCompositionEnd);
    input.addEventListener('input', reset);
    return () => {
      input.removeEventListener('beforeinput', onBeforeInput);
      input.removeEventListener('compositionend', onCompositionEnd);
      input.removeEventListener('input', reset);
    };
  }, []);

  // Keep the selected square visible, and the hidden input on top of it (so phones
  // scroll to it and IME suggestion windows appear next to it).
  useEffect(() => {
    const id =
      selection.view === 'grid' ? gridSquareId(selection.cell) : clueBlankId(selection.cell);
    const target = document.getElementById(id);
    target?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    const root = rootRef.current;
    const input = inputRef.current;
    if (target && root && input) {
      const t = target.getBoundingClientRect();
      const r = root.getBoundingClientRect();
      input.style.transform = `translate(${t.left - r.left}px, ${t.top - r.top}px)`;
    }
  }, [selection]);

  useEffect(() => {
    onSelectionChange?.(selection.cell);
  }, [selection.cell, onSelectionChange]);

  const cluePosition = index.cluePositionOf(context.clue);
  const lastCluePosition = index.clues.length - 1;
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing || event.key === 'Process') return;
    const action = keyToAction(event, selection.view);
    // Characters come through input events instead (see above).
    if (!action || action.type === 'input') return;
    // Tab past the last clue (or Shift+Tab before the first) leaves the solver,
    // so keyboard users are never trapped.
    const tabbingOut =
      event.key === 'Tab' &&
      ((!event.shiftKey && cluePosition === lastCluePosition) ||
        (event.shiftKey && cluePosition === 0));
    if (tabbingOut) return;
    event.preventDefault();
    apply(action);
  };

  const select = useCallback((cell: CellNumber, view: 'grid' | 'clue') => {
    setSelection({ cell, view });
    inputRef.current?.focus({ preventScroll: true });
  }, []);
  const selectInGrid = useCallback((cell: CellNumber) => select(cell, 'grid'), [select]);
  const selectInClues = useCallback((cell: CellNumber) => select(cell, 'clue'), [select]);

  const entry = solve[selection.cell];
  const where = `Square ${selection.cell}, clue ${context.clue} letter ${context.position + 1} of ${context.clueCells.length}, ${entry ?? 'empty'}`;

  return (
    <div className={styles.solver} ref={rootRef}>
      <header className={styles.header}>
        <h2 className={styles.title}>{puzzle.title ?? 'Untitled puzzle'}</h2>
        {puzzle.constructedBy && <p className={styles.byline}>By {puzzle.constructedBy}</p>}
      </header>
      <AcrosticBar index={index} solve={solve} />
      <input
        ref={inputRef}
        className={styles.entry}
        aria-label="Answer entry"
        aria-describedby="solver-where"
        defaultValue={SENTINEL}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        enterKeyHint="next"
        onKeyDown={onKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
      <p id="solver-where" className="visually-hidden" aria-live="polite">
        {where}
      </p>
      <div className={styles.layout}>
        <div className={styles.gridPane}>
          <HistoryButtons
            canUndo={canUndo(history, solve)}
            canRedo={canRedo(history, solve)}
            onUndo={() => step('undo')}
            onRedo={() => step('redo')}
          />
          <Grid
            index={index}
            solve={solve}
            selectedCell={selection.cell}
            wordCells={context.wordCells}
            clueCells={context.clueCells}
            peers={peers}
            focused={focused && selection.view === 'grid'}
            onSelect={selectInGrid}
          />
          <p className={styles.hint}>
            Tap or click a square to type · Arrows move · Tab next clue · Enter switches between
            grid and clues
          </p>
        </div>
        <div className={styles.cluePane}>
          <ClueList
            index={index}
            solve={solve}
            selectedCell={selection.cell}
            selectedClue={context.clue}
            peers={peers}
            focused={focused && selection.view === 'clue'}
            onSelect={selectInClues}
          />
        </div>
      </div>
    </div>
  );
}

const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

interface HistoryButtonsProps {
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly onUndo: () => void;
  readonly onRedo: () => void;
}

/** Undo/Redo buttons. They don't take focus, so typing continues after a click. */
function HistoryButtons({ canUndo, canRedo, onUndo, onRedo }: HistoryButtonsProps) {
  const keepFocus = (event: { preventDefault: () => void }) => event.preventDefault();
  const undoKeys = IS_MAC ? '⌘Z' : 'Ctrl+Z';
  const redoKeys = IS_MAC ? '⇧⌘Z' : 'Ctrl+Y';
  return (
    <div className={styles.toolbar} role="toolbar" aria-label="Edit history">
      <button
        type="button"
        onMouseDown={keepFocus}
        onClick={onUndo}
        disabled={!canUndo}
        title={`Undo your last change (${undoKeys})`}
        aria-keyshortcuts="Control+Z Meta+Z"
      >
        <span aria-hidden="true">↶</span> Undo
      </button>
      <button
        type="button"
        onMouseDown={keepFocus}
        onClick={onRedo}
        disabled={!canRedo}
        title={`Redo (${redoKeys})`}
        aria-keyshortcuts="Control+Shift+Z Meta+Shift+Z Control+Y"
      >
        <span aria-hidden="true">↷</span> Redo
      </button>
    </div>
  );
}
