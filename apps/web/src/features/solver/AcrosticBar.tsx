import { acrosticLetters, filledCount, type PuzzleIndex, type SolveState } from '@acrosticle/core';
import styles from './AcrosticBar.module.css';

export interface AcrosticBarProps {
  readonly index: PuzzleIndex;
  readonly solve: SolveState;
}

/** Progress, plus the acrostic (first letter of each answer) as it forms. */
export function AcrosticBar({ index, solve }: AcrosticBarProps) {
  const letters = acrosticLetters(index, solve);
  const total = index.cells.length;
  const filled = filledCount(solve);

  return (
    <section className={styles.bar} aria-label="Progress">
      <p className={styles.count}>
        {filled} / {total} squares filled
      </p>
      <p
        className={styles.acrostic}
        aria-label={`First letters: ${letters.map((l) => l ?? 'blank').join(' ')}`}
      >
        {index.clues.map((clue, i) => (
          <span key={clue.label} className={styles.slot} title={`Clue ${clue.label}`}>
            {letters[i] ?? '·'}
          </span>
        ))}
      </p>
    </section>
  );
}
