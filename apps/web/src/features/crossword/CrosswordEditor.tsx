import {
  buildCrosswordIndex,
  cellOf,
  formatClueText,
  hasCrosswordErrors,
  parseClueText,
  resizeCrossword,
  toggleBlock,
  validateCrossword,
  type Crossword,
} from '@gridicles/crossword';
import { useId, useMemo, useState } from 'react';
import { PuzzleGrid, type GridLayout, type SquareView } from '../../components/PuzzleGrid';
import styles from './CrosswordEditor.module.css';
import { tidyClueText } from './tidyApi';

export interface CrosswordEditorProps {
  /** The crossword to start from: an import, a photo's draft, or a blank grid. */
  readonly initial: Crossword;
  readonly onStart: (crossword: Crossword) => void;
  readonly starting?: boolean;
}

/** Undo history for grid edits (oldest first). */
interface GridHistory {
  readonly past: readonly Crossword[];
  readonly future: readonly Crossword[];
}

/**
 * Checks and fixes a crossword before solving: the grid on top (click squares
 * to make them black or open, mirror symmetry on by default, resize), and all
 * the clues as one block of text below. Problems are listed as you go, but
 * only a grid with no open squares stops you starting: odd puzzles may break
 * the usual rules on purpose.
 */
export function CrosswordEditor({ initial, onStart, starting = false }: CrosswordEditorProps) {
  const [grid, setGrid] = useState(initial);
  const [history, setHistory] = useState<GridHistory>({ past: [], future: [] });
  const [symmetric, setSymmetric] = useState(true);
  const [size, setSize] = useState({ width: initial.width, height: initial.height });
  const [title, setTitle] = useState(initial.title ?? '');
  const [author, setAuthor] = useState(initial.author ?? '');
  const [clueText, setClueText] = useState(() => formatClueText(initial.clues));
  const [tidy, setTidy] = useState<{
    readonly busy: boolean;
    readonly error?: string;
    readonly notes?: readonly string[];
    /** The text before tidying, to put back. */
    readonly before?: string;
  }>({ busy: false });
  const ids = useId();

  const parsed = useMemo(() => parseClueText(clueText), [clueText]);
  const crossword = useMemo<Crossword>(() => {
    const { title: _t, author: _a, ...rest } = grid;
    return {
      ...rest,
      ...(title.trim() && { title: title.trim() }),
      ...(author.trim() && { author: author.trim() }),
      clues: parsed.clues,
    };
  }, [grid, title, author, parsed.clues]);
  const index = useMemo(() => buildCrosswordIndex(crossword), [crossword]);
  const issues = useMemo(() => validateCrossword(index), [index]);
  const warnings = [...parsed.problems.map((p) => p.message), ...issues.map((i) => i.message)];

  /** Sends the clue text to Claude and swaps in the tidied clues (keeping the original to restore). */
  const tidyWithClaude = async () => {
    const before = clueText;
    setTidy({ busy: true });
    const result = await tidyClueText(before);
    if (result.ok) {
      setClueText(formatClueText(result.value.clues));
      setTidy({ busy: false, notes: result.value.notes, before });
    } else {
      setTidy({ busy: false, error: result.error });
    }
  };

  const edit = (next: Crossword) => {
    setHistory((h) => ({ past: [...h.past, grid], future: [] }));
    setGrid(next);
  };
  const step = (from: 'past' | 'future') => {
    const list = history[from];
    const target = list.at(-1);
    if (!target) return;
    const rest = list.slice(0, -1);
    setHistory(
      from === 'past'
        ? { past: rest, future: [...history.future, grid] }
        : { past: [...history.past, grid], future: rest },
    );
    setGrid(target);
    setSize({ width: target.width, height: target.height });
  };

  const layout = useMemo<GridLayout>(
    () => ({
      columns: grid.width,
      squares: grid.squares.map((square, i) =>
        square.kind === 'block'
          ? { kind: 'block' }
          : { kind: 'letter', label: String(index.numberAt(cellOf(i)) ?? '') },
      ),
    }),
    [grid, index],
  );
  const viewSquare = (i: number): SquareView => {
    const { row, column } = index.positionOf(cellOf(i));
    const open = grid.squares[i]?.kind === 'open';
    return { ariaLabel: `Row ${row + 1}, column ${column + 1}, ${open ? 'open' : 'black'}` };
  };

  return (
    <section className={styles.editor} aria-labelledby={`${ids}-heading`}>
      <h2 id={`${ids}-heading`}>Check the crossword</h2>
      <div className={styles.meta}>
        <label>
          Title <input value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label>
          By <input value={author} onChange={(e) => setAuthor(e.target.value)} />
        </label>
      </div>

      <div className={styles.tools} role="toolbar" aria-label="Grid">
        <label>
          Width{' '}
          <input
            type="number"
            min={2}
            max={40}
            value={size.width}
            onChange={(e) => setSize((s) => ({ ...s, width: Number(e.target.value) }))}
          />
        </label>
        <label>
          Height{' '}
          <input
            type="number"
            min={2}
            max={40}
            value={size.height}
            onChange={(e) => setSize((s) => ({ ...s, height: Number(e.target.value) }))}
          />
        </label>
        <button
          type="button"
          disabled={size.width === grid.width && size.height === grid.height}
          onClick={() => {
            const next = resizeCrossword(grid, size.width, size.height);
            edit(next);
            setSize({ width: next.width, height: next.height });
          }}
        >
          Resize
        </button>
        <label>
          <input
            type="checkbox"
            checked={symmetric}
            onChange={(e) => setSymmetric(e.target.checked)}
          />{' '}
          Symmetric
        </label>
        <button type="button" disabled={history.past.length === 0} onClick={() => step('past')}>
          ↶ Undo
        </button>
        <button type="button" disabled={history.future.length === 0} onClick={() => step('future')}>
          ↷ Redo
        </button>
      </div>
      <p className={styles.note}>
        Click a square to make it black or open
        {symmetric ? '; its mirror square follows.' : '.'} Numbers update as you go.
      </p>
      <div className={styles.grid}>
        <PuzzleGrid
          grid={layout}
          label="Crossword grid editor"
          viewSquare={viewSquare}
          onSquareClick={(i) => edit(toggleBlock(grid, cellOf(i), symmetric))}
        />
      </div>

      <label htmlFor={`${ids}-clues`} className={styles.cluesLabel}>
        Clues
      </label>
      <p id={`${ids}-clues-help`} className={styles.note}>
        One clue per line, under ACROSS and DOWN headings, like “1. Fuel at the pump”. Paste clues
        in from anywhere and fix them here.
      </p>
      <textarea
        id={`${ids}-clues`}
        aria-describedby={`${ids}-clues-help`}
        className={styles.clues}
        rows={18}
        value={clueText}
        spellCheck={false}
        onChange={(e) => setClueText(e.target.value)}
      />
      <div className={styles.tidy}>
        <button
          type="button"
          disabled={tidy.busy || clueText.trim() === ''}
          onClick={() => void tidyWithClaude()}
        >
          {tidy.busy ? 'Tidying…' : 'Tidy with Claude'}
        </button>
        {tidy.before !== undefined && !tidy.busy && (
          <button
            type="button"
            onClick={() => {
              setClueText(tidy.before ?? '');
              setTidy({ busy: false });
            }}
          >
            Put my text back
          </button>
        )}
        <span className={styles.note}>
          For messy text (from a PDF or web page): Claude sorts it into clues.
        </span>
      </div>
      {tidy.error && (
        <p role="alert" className="error">
          {tidy.error}
        </p>
      )}
      {tidy.notes && tidy.notes.length > 0 && (
        <div className={styles.issues} aria-live="polite">
          <h3>Claude wasn’t sure about</h3>
          <ul>
            {tidy.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      )}

      {warnings.length > 0 && (
        <div className={styles.issues}>
          <h3>Worth a look</h3>
          <p className={styles.note}>
            These won’t stop you solving: some puzzles break the rules on purpose.
          </p>
          <ul aria-label="Problems found">
            {warnings.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </div>
      )}
      <p>
        <button
          type="button"
          className={styles.start}
          disabled={starting || hasCrosswordErrors(issues)}
          onClick={() => onStart(crossword)}
        >
          Start solving
        </button>
        {hasCrosswordErrors(issues) && (
          <span className={styles.note}> The grid needs at least one open square.</span>
        )}
      </p>
    </section>
  );
}
