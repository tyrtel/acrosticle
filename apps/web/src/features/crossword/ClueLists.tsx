import type { CrosswordIndex, Direction, Word } from '@gridicles/crossword';
import { memo, useEffect } from 'react';
import { ToolButton } from '../../components/SolverShell';
import styles from './CrosswordSolver.module.css';
import { crosswordClueId } from './elementIds';

export interface ClueListsProps {
  readonly index: CrosswordIndex;
  /** The word being typed in (tinted blue). */
  readonly current: Word | undefined;
  /** The word crossing it at the cursor (tinted lightly). */
  readonly crossing: Word | undefined;
  readonly onSelect: (word: Word) => void;
}

/** The Across and Down clue lists. Clicking a clue moves the cursor to it. */
export function ClueLists({ index, current, crossing, onSelect }: ClueListsProps) {
  // Keep the current clue in view as the cursor moves.
  useEffect(() => {
    if (!current) return;
    document
      .getElementById(crosswordClueId(current.direction, current.number))
      ?.scrollIntoView?.({ block: 'nearest' });
  }, [current]);

  return (
    <div className={styles.clueLists}>
      {(['across', 'down'] as const).map((direction) => (
        <ClueList
          key={direction}
          direction={direction}
          words={index.words(direction)}
          current={current?.direction === direction ? current.number : null}
          crossing={crossing?.direction === direction ? crossing.number : null}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

const ClueList = memo(function ClueList({
  direction,
  words,
  current,
  crossing,
  onSelect,
}: {
  readonly direction: Direction;
  readonly words: readonly Word[];
  readonly current: number | null;
  readonly crossing: number | null;
  readonly onSelect: (word: Word) => void;
}) {
  const heading = direction === 'across' ? 'Across' : 'Down';
  return (
    <section className={styles.clueList} aria-label={`${heading} clues`}>
      <h3>{heading}</h3>
      <ol>
        {words.map((word) => {
          const className =
            word.number === current
              ? styles.currentClue
              : word.number === crossing
                ? styles.crossingClue
                : undefined;
          return (
            <li key={word.number} id={crosswordClueId(direction, word.number)}>
              <ToolButton
                className={className}
                aria-current={word.number === current ? 'true' : undefined}
                aria-label={`${word.number} ${heading}: ${word.clue ?? 'no clue'}`}
                onClick={() => onSelect(word)}
              >
                <span className={styles.clueNumber}>{word.number}</span>
                <span>{word.clue ?? <em>(no clue)</em>}</span>
              </ToolButton>
            </li>
          );
        })}
      </ol>
    </section>
  );
});
