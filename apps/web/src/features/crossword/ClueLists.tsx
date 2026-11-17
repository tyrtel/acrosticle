import type { CrosswordIndex, Direction, Word } from '@gridicles/crossword';
import { memo, useEffect } from 'react';
import { ToolButton } from '../../components/SolverShell';
import styles from './CrosswordSolver.module.css';
import { crosswordClueId } from './elementIds';
import { directionName, wordName } from './labels';

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
          heading={directionName(index, direction, true)}
          nameOf={(word) => wordName(index, word)}
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
  heading,
  nameOf,
  words,
  current,
  crossing,
  onSelect,
}: {
  readonly direction: Direction;
  readonly heading: string;
  readonly nameOf: (word: Word) => string;
  readonly words: readonly Word[];
  readonly current: number | null;
  readonly crossing: number | null;
  readonly onSelect: (word: Word) => void;
}) {
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
                aria-label={`${nameOf(word)}: ${word.clue ?? 'no clue'}`}
                onClick={() => onSelect(word)}
              >
                <span className={styles.clueNumber}>{word.label}</span>
                <ClueText text={word.clue} />
              </ToolButton>
            </li>
          );
        })}
      </ol>
    </section>
  );
});

/** A clue, or a row's several clues (separated by " / ") one per line. */
function ClueText({ text }: { readonly text: string | null }) {
  if (text === null) return <em>(no clue)</em>;
  const parts = text.split(' / ');
  if (parts.length === 1) return <span>{text}</span>;
  return (
    <span className={styles.clueParts}>
      {parts.map((part, i) => (
        <span key={i}>{part}</span>
      ))}
    </span>
  );
}
