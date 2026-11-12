import { entryLayout, type EntrySpace } from './entryLayout';
import styles from './EntryText.module.css';

export interface EntryTextProps {
  readonly entry: string | null;
  readonly space: EntrySpace;
  /** Show the full entry's callout (e.g. the square is selected); it also shows on hover. */
  readonly open?: boolean | undefined;
  /** Where the callout appears relative to the square or blank. */
  readonly calloutPlacement?: 'above' | 'below' | undefined;
}

/**
 * A square's entry, sized to stay readable however long it is (see
 * entryLayout). Purely visual: callers put the full entry in their ARIA
 * label. Must sit inside a positioned element, which the callout attaches to.
 */
export function EntryText({
  entry,
  space,
  open = false,
  calloutPlacement = 'above',
}: EntryTextProps) {
  if (entry === null) return null;
  const layout = entryLayout(entry, space);
  return (
    <>
      <span className={styles[layout.size]}>{layout.text}</span>
      {layout.callout && (
        <span
          className={[styles.callout, styles[calloutPlacement], open && styles.open]
            .filter(Boolean)
            .join(' ')}
        >
          {entry}
        </span>
      )}
    </>
  );
}
