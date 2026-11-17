import type { Crossword, CrosswordClue, CrosswordStyle, Direction } from './puzzle';
import { columnLabel } from './puzzle';

/** A line of the clue text that couldn't be read as a clue (kept, and reported). */
export interface ClueTextProblem {
  /** 1-based line number in the text. */
  readonly line: number;
  readonly text: string;
  readonly message: string;
}

export interface ClueTextResult {
  readonly clues: Crossword['clues'];
  readonly problems: readonly ClueTextProblem[];
}

const HEADING = /^\s*(across|down|rows?|columns?)\s*:?\s*$/i;
// Rows-and-columns puzzles label columns with letters: "B. Clue".
const LETTERED = /^\s*([A-Z]{1,2})\s*[.):-]\s+(.+?)\s*$/;
// "1. Clue", "1) Clue", "1: Clue", "1 Clue", and "1A Clue" / "1-Down Clue" (direction in the number).
const CLUE = /^\s*(\d+)\s*(?:-?\s*(a|d|across|down)\b)?\s*[.):-]?\s+(.+?)\s*$/i;

/**
 * Reads clues typed or pasted as text, the way they're printed:
 *
 *   ACROSS
 *   1. Fuel at the pump
 *   DOWN
 *   1 Laughing ___
 *
 * Headings can be any case; a number may carry its direction ("1A", "1-Down") instead.
 * Lines that can't be read are reported, not dropped silently, so nothing is lost.
 */
export function parseClueText(text: string): ClueTextResult {
  const clues: Record<Direction, CrosswordClue[]> = { across: [], down: [] };
  const problems: ClueTextProblem[] = [];
  let direction: Direction | null = null;

  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (line === '') return;
    const heading = HEADING.exec(line);
    if (heading?.[1]) {
      const name = heading[1].toLowerCase();
      direction = name === 'across' || name.startsWith('row') ? 'across' : 'down';
      return;
    }
    const lettered = LETTERED.exec(line);
    if (lettered?.[1] && lettered[2] && direction === 'down') {
      clues.down.push({ number: columnNumber(lettered[1]), text: lettered[2] });
      return;
    }
    const clue = CLUE.exec(line);
    if (!clue?.[1] || !clue[3]) {
      problems.push({ line: i + 1, text: line, message: `Line ${i + 1} isn't a numbered clue.` });
      return;
    }
    const named = clue[2]?.toLowerCase();
    const target: Direction | null = named
      ? named.startsWith('a')
        ? 'across'
        : 'down'
      : direction;
    if (!target) {
      problems.push({
        line: i + 1,
        text: line,
        message: `Line ${i + 1} comes before an ACROSS or DOWN heading.`,
      });
      return;
    }
    clues[target].push({ number: Number(clue[1]), text: clue[3] });
  });

  return { clues, problems };
}

/**
 * Writes clues as text, in the form `parseClueText` reads. Rows-and-columns
 * puzzles use ROWS and COLUMNS headings, with columns labelled by letter.
 */
export function formatClueText(
  clues: Crossword['clues'],
  style: CrosswordStyle = 'standard',
): string {
  const rows = style === 'rows-columns';
  const section = (title: string, list: readonly CrosswordClue[], lettered: boolean) =>
    [
      title,
      ...list.map(
        (clue) => `${lettered ? columnLabel(clue.number - 1) : clue.number}. ${clue.text}`,
      ),
    ].join('\n');
  return `${section(rows ? 'ROWS' : 'ACROSS', clues.across, false)}\n\n${section(
    rows ? 'COLUMNS' : 'DOWN',
    clues.down,
    rows,
  )}`;
}

/** "A" is column 1, "Z" 26, "AA" 27. */
function columnNumber(label: string): number {
  return [...label].reduce((n, ch) => n * 26 + (ch.charCodeAt(0) - 64), 0);
}
