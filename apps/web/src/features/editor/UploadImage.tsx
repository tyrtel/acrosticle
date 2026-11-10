import type { Puzzle } from '@acrosticle/core';
import { parsePuzzleFile } from '@acrosticle/protocol';
import { useEffect, useId, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { downscaleImage } from '../../lib/downscale';
import styles from './Editor.module.css';
import { parseImage } from './parseApi';

export interface ParsedImage {
  readonly puzzle: Puzzle;
  /** What Claude was unsure about. */
  readonly notes: readonly string[];
}

export interface UploadImageProps {
  readonly onParsed: (result: ParsedImage) => void;
  /** Prepares the image before upload (default: scale down to Claude's size limit). */
  readonly prepare?: (file: File) => Promise<Blob>;
}

type Stage =
  | { readonly kind: 'choose' }
  | { readonly kind: 'reading'; readonly started: number }
  | { readonly kind: 'failed'; readonly error: string };

/** Upload a photo or scan of an acrostic; Claude reads it into a draft to review. */
export function UploadImage({ onParsed, prepare = downscaleImage }: UploadImageProps) {
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<Stage>({ kind: 'choose' });
  const abort = useRef<AbortController | null>(null);
  const id = useId();

  useEffect(() => () => abort.current?.abort(), []);
  const preview = useMemo(
    () => (file && typeof URL.createObjectURL === 'function' ? URL.createObjectURL(file) : null),
    [file],
  );
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  const choose = (event: ChangeEvent<HTMLInputElement>) => {
    setFile(event.target.files?.[0] ?? null);
    setStage({ kind: 'choose' });
  };

  const read = async () => {
    if (!file) return;
    const controller = new AbortController();
    abort.current = controller;
    setStage({ kind: 'reading', started: Date.now() });

    let image: Blob;
    try {
      image = await prepare(file);
    } catch {
      setStage({ kind: 'failed', error: "This file couldn't be opened as an image." });
      return;
    }
    const result = await parseImage(image, controller.signal);
    if (controller.signal.aborted) return;
    if (!result.ok) {
      setStage({ kind: 'failed', error: result.error });
      return;
    }
    const puzzle = parsePuzzleFile(result.value.file);
    if (!puzzle.ok) {
      setStage({ kind: 'failed', error: 'The server sent an unexpected response.' });
      return;
    }
    onParsed({ puzzle: puzzle.value, notes: result.value.notes });
  };

  const cancel = () => {
    abort.current?.abort();
    setStage({ kind: 'choose' });
  };

  return (
    <section className={styles.import} aria-labelledby={`${id}-heading`}>
      <h2 id={`${id}-heading`}>Upload a puzzle image</h2>
      <p>
        A clear scan or screenshot of the whole puzzle works best. Claude reads the grid and clues,
        then you check them before solving.
      </p>
      <p>
        <label>
          Choose an image{' '}
          <input
            type="file"
            accept="image/*"
            onChange={choose}
            disabled={stage.kind === 'reading'}
          />
        </label>
      </p>
      {preview && <img className={styles.preview} src={preview} alt="The chosen puzzle image" />}
      {stage.kind === 'reading' ? (
        <Reading started={stage.started} onCancel={cancel} />
      ) : (
        <p>
          <button type="button" disabled={!file} onClick={() => void read()}>
            Read the puzzle
          </button>
        </p>
      )}
      {stage.kind === 'failed' && (
        <p role="alert" className={styles.error}>
          {stage.error}
        </p>
      )}
    </section>
  );
}

function Reading({ started, onCancel }: { started: number; onCancel: () => void }) {
  const [now, setNow] = useState(started);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const seconds = Math.max(0, Math.floor((now - started) / 1000));
  return (
    <p className={styles.reading}>
      <span role="status">Reading the puzzle… {seconds}s</span> This usually takes under two
      minutes.{' '}
      <button type="button" onClick={onCancel}>
        Cancel
      </button>
    </p>
  );
}
