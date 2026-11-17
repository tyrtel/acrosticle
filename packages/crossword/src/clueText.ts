import type { Crossword, CrosswordClue, Direction } from './puzzle';

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

const HEADING = /^\s*(across|down)\s*:?\s*$/i;
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
      direction = heading[1].toLowerCase() === 'across' ? 'across' : 'down';
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

/** Writes clues as text, in the form `parseClueText` reads. */
export function formatClueText(clues: Crossword['clues']): string {
  const section = (title: string, list: readonly CrosswordClue[]) =>
    [title, ...list.map((clue) => `${clue.number}. ${clue.text}`)].join('\n');
  return `${section('ACROSS', clues.across)}\n\n${section('DOWN', clues.down)}`;
}
