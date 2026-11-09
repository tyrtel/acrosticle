import type { IssueSeverity, SuggestedFix, ValidationIssue } from '@acrosticle/core';
import styles from './Editor.module.css';

export interface IssueListProps {
  readonly issues: readonly ValidationIssue[];
  readonly onFix: (fix: SuggestedFix) => void;
  readonly onShow: (gridIndex: number) => void;
}

const ORDER: Record<IssueSeverity, number> = { error: 0, warning: 1, info: 2 };
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** Validation problems, most severe first, with one-click fixes where available. */
export function IssueList({ issues, onFix, onShow }: IssueListProps) {
  if (issues.length === 0) {
    return <p className={styles.ok}>No problems found.</p>;
  }

  const count = (severity: IssueSeverity) => issues.filter((i) => i.severity === severity).length;
  const sorted = [...issues].sort((a, b) => ORDER[a.severity] - ORDER[b.severity]);

  return (
    <section aria-label="Problems">
      <p className={styles.summary}>
        {plural(count('error'), 'error')}, {plural(count('warning'), 'warning')},{' '}
        {plural(count('info'), 'note')}
      </p>
      <ul className={styles.issues}>
        {sorted.map((issue, i) => {
          const gridIndex = issue.gridIndexes?.[0];
          return (
            <li key={i} className={styles[issue.severity]}>
              <span className={styles.severity}>{issue.severity}</span> {issue.message}{' '}
              {issue.fix && (
                <button type="button" onClick={() => issue.fix && onFix(issue.fix)}>
                  Fix
                </button>
              )}
              {gridIndex !== undefined && (
                <button type="button" onClick={() => onShow(gridIndex)}>
                  Show
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
