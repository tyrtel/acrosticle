import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from 'react';
import type { ApiResult } from '../../lib/api';
import { downscaleImage } from '../../lib/downscale';
import styles from './ImageUpload.module.css';

export interface ImageUploadProps<T> {
  readonly heading: string;
  /** What to photograph and what happens next. */
  readonly intro: ReactNode;
  /** Uploads the (prepared) image for Claude to read. */
  readonly read: (image: Blob, signal: AbortSignal) => Promise<ApiResult<T>>;
  /** Called with the server's answer; return an error message to show instead, if it's unusable. */
  readonly onRead: (result: T) => string | undefined;
  /** Prepares the image before upload (default: scale down to Claude's size limit). */
  readonly prepare?: (file: File) => Promise<Blob>;
}

type Stage =
  | { readonly kind: 'choose' }
  | { readonly kind: 'reading'; readonly started: number }
  | { readonly kind: 'failed'; readonly error: string };

/** Choose a photo or scan, preview it, and have Claude read it (with a timer and Cancel). */
export function ImageUpload<T>({
  heading,
  intro,
  read,
  onRead,
  prepare = downscaleImage,
}: ImageUploadProps<T>) {
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

  const start = async () => {
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
    const result = await read(image, controller.signal);
    if (controller.signal.aborted) return;
    if (!result.ok) {
      setStage({ kind: 'failed', error: result.error });
      return;
    }
    const problem = onRead(result.value);
    if (problem) setStage({ kind: 'failed', error: problem });
  };

  const cancel = () => {
    abort.current?.abort();
    setStage({ kind: 'choose' });
  };

  return (
    <section className={styles.upload} aria-labelledby={`${id}-heading`}>
      <h2 id={`${id}-heading`}>{heading}</h2>
      <p>{intro}</p>
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
          <button type="button" disabled={!file} onClick={() => void start()}>
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
