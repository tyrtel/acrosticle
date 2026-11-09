import type { GridSquare } from '@acrosticle/core';
import { useId } from 'react';
import styles from './Editor.module.css';

export interface SquareEditorProps {
  readonly square: GridSquare;
  /** Used when turning a non-letter square into a letter square. */
  readonly defaultLetter: Extract<GridSquare, { kind: 'letter' }>;
  readonly onChange: (square: GridSquare) => void;
}

/** Edit one grid square: its kind, and its number and clue label or punctuation. */
export function SquareEditor({ square, defaultLetter, onChange }: SquareEditorProps) {
  const id = useId();

  const setKind = (kind: GridSquare['kind']) => {
    switch (kind) {
      case 'letter':
        return onChange(defaultLetter);
      case 'block':
        return onChange({ kind: 'block' });
      case 'punctuation':
        return onChange({ kind: 'punctuation', char: ',' });
    }
  };

  return (
    <fieldset className={styles.squareEditor}>
      <legend>Selected square</legend>
      <label>
        Kind{' '}
        <select value={square.kind} onChange={(e) => setKind(e.target.value as GridSquare['kind'])}>
          <option value="letter">Letter</option>
          <option value="block">Black square</option>
          <option value="punctuation">Punctuation</option>
        </select>
      </label>
      {square.kind === 'letter' && (
        <>
          <label htmlFor={`${id}-number`}>Number</label>
          <input
            id={`${id}-number`}
            type="number"
            min={1}
            value={square.number}
            onChange={(e) => onChange({ ...square, number: Number(e.target.value) })}
          />
          <label htmlFor={`${id}-clue`}>Clue</label>
          <input
            id={`${id}-clue`}
            value={square.clue}
            size={3}
            onChange={(e) =>
              onChange({ ...square, clue: e.target.value.toUpperCase().replace(/[^A-Z]/g, '') })
            }
          />
        </>
      )}
      {square.kind === 'punctuation' && (
        <>
          <label htmlFor={`${id}-char`}>Character</label>
          <input
            id={`${id}-char`}
            value={square.char}
            maxLength={1}
            size={2}
            onChange={(e) => onChange({ kind: 'punctuation', char: e.target.value })}
          />
        </>
      )}
    </fieldset>
  );
}
