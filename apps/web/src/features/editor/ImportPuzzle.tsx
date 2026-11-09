import type { Puzzle } from '@acrosticle/core';
import { parsePuzzleFile } from '@acrosticle/protocol';
import { useId, useState, type ChangeEvent, type FormEvent } from 'react';
import styles from './Editor.module.css';

export interface ImportPuzzleProps {
  readonly onImport: (puzzle: Puzzle) => void;
}

/** Load a puzzle file by choosing a .json file or pasting its contents. */
export function ImportPuzzle({ onImport }: ImportPuzzleProps) {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const textId = useId();

  const load = (raw: string) => {
    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch {
      setError("That isn't valid JSON.");
      return;
    }
    const result = parsePuzzleFile(data);
    if (result.ok) onImport(result.value);
    else setError(`That isn't a valid puzzle file: ${result.error}`);
  };

  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) load(await file.text());
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    load(text);
  };

  return (
    <section className={styles.import} aria-labelledby={`${textId}-heading`}>
      <h2 id={`${textId}-heading`}>Import a puzzle file</h2>
      <p>
        <label>
          Choose a file{' '}
          <input type="file" accept=".json,application/json" onChange={(e) => void onFile(e)} />
        </label>
      </p>
      <form onSubmit={onSubmit}>
        <label htmlFor={textId}>Or paste the file contents</label>
        <textarea
          id={textId}
          className={styles.paste}
          rows={10}
          value={text}
          onChange={(e) => setText(e.target.value)}
          spellCheck={false}
        />
        <button type="submit" disabled={text.trim() === ''}>
          Load puzzle
        </button>
      </form>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
    </section>
  );
}
