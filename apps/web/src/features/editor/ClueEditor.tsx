import type { CellNumber, Clue } from '@acrosticle/core';
import { useId, useState } from 'react';
import styles from './Editor.module.css';
import { parseCellList } from './parseCellList';

export interface ClueEditorProps {
  readonly clue: Clue;
  readonly hasIssue: boolean;
  readonly onChange: (changes: { text?: string; cells?: CellNumber[] }) => void;
}

/** Edit a clue's text and its list of answer blanks. */
export function ClueEditor({ clue, hasIssue, onChange }: ClueEditorProps) {
  const id = useId();
  // The blanks field keeps its own text so half-typed input isn't rejected.
  const [cellsText, setCellsText] = useState(clue.cells.join(' '));
  const parsed = parseCellList(cellsText);

  return (
    <fieldset className={hasIssue ? `${styles.clueEditor} ${styles.flagged}` : styles.clueEditor}>
      <legend>Clue {clue.label}</legend>
      <label htmlFor={`${id}-text`}>Text</label>
      <input
        id={`${id}-text`}
        value={clue.text}
        onChange={(e) => onChange({ text: e.target.value })}
      />
      <label htmlFor={`${id}-cells`}>Blanks</label>
      <input
        id={`${id}-cells`}
        value={cellsText}
        aria-invalid={!parsed.ok}
        aria-describedby={parsed.ok ? undefined : `${id}-error`}
        onChange={(e) => {
          setCellsText(e.target.value);
          const result = parseCellList(e.target.value);
          if (result.ok) onChange({ cells: result.cells });
        }}
      />
      {!parsed.ok && (
        <span id={`${id}-error`} className={styles.error}>
          {parsed.error}
        </span>
      )}
    </fieldset>
  );
}
