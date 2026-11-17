import type { Crossword } from '@gridicles/crossword';
import { useId, useState, type ChangeEvent, type FormEvent } from 'react';
import styles from './CrosswordSolver.module.css';
import { CROSSWORD_FILE_TYPES, readCrosswordFile, readCrosswordText } from './readCrosswordFile';

export interface ImportCrosswordProps {
  /** Called with the crossword read, to check in the editor. */
  readonly onLoad: (crossword: Crossword) => void;
}

/** Load a crossword from a .puz, .ipuz or JSON file, or pasted text, for the editor. */
export function ImportCrossword({ onLoad }: ImportCrosswordProps) {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const textId = useId();

  const accept = (result: ReturnType<typeof readCrosswordText>) => {
    if (result.ok) onLoad(result.crossword);
    else setError(`That crossword couldn't be read: ${result.error}`);
  };

  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) accept(readCrosswordFile(file.name, new Uint8Array(await file.arrayBuffer())));
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    accept(readCrosswordText(text));
  };

  return (
    <section className={styles.import} aria-labelledby={`${textId}-heading`}>
      <h2 id={`${textId}-heading`}>Import a crossword</h2>
      <p>
        <label>
          Choose a file (.puz, .ipuz or .json){' '}
          <input type="file" accept={CROSSWORD_FILE_TYPES} onChange={(e) => void onFile(e)} />
        </label>
      </p>
      <form onSubmit={onSubmit}>
        <label htmlFor={textId}>Or paste an .ipuz or JSON file</label>
        <textarea
          id={textId}
          className={styles.paste}
          rows={8}
          value={text}
          onChange={(e) => setText(e.target.value)}
          spellCheck={false}
        />
        <button type="submit" disabled={text.trim() === ''}>
          Load crossword
        </button>
      </form>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </section>
  );
}
