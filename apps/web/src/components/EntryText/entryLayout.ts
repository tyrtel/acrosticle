/** Where an entry is drawn: a grid square, or a clue's answer blank (which can widen). */
export type EntrySpace = 'square' | 'blank';

/** Text size steps, each smaller than the last (see EntryText.module.css). */
export type EntrySize = 'one' | 'two' | 'three' | 'lines' | 'linesNarrow' | 'wide';

export interface EntryLayout {
  /** What fits in the space: the entry, or its start and "…". Two-line text has a "\n". */
  readonly text: string;
  readonly size: EntrySize;
  /** Hard to read in place (two lines or cut short), so offer the full entry in a callout. */
  readonly callout: boolean;
}

const ELLIPSIS = '…';

/**
 * How to fit an entry into a square or blank so it stays readable: smaller
 * text as it grows, then its start and "…". Counts characters, not UTF-16 units.
 *
 * | Characters | Square              | Blank                     |
 * | ---------- | ------------------- | ------------------------- |
 * | 1          | as is               | as is                     |
 * | 2, 3       | smaller, one line   | smaller, blank widens     |
 * | 4          | two lines           | smaller, blank widens     |
 * | 5, 6       | two lines           | first 3 + "…"             |
 * | 7+         | first 5 + "…"       | first 3 + "…"             |
 *
 * Two-line text breaks at the most even space where both lines have at most
 * four characters (drawn a size smaller if one has four), else in the middle.
 */
export function entryLayout(entry: string, space: EntrySpace): EntryLayout {
  const characters = Array.from(entry);
  const count = characters.length;
  const start = (n: number) => characters.slice(0, n).join('') + ELLIPSIS;

  if (count <= 1) return { text: entry, size: 'one', callout: false };
  if (space === 'blank') {
    return count <= 4
      ? { text: entry, size: 'wide', callout: false }
      : { text: start(3), size: 'wide', callout: true };
  }
  if (count === 2) return { text: entry, size: 'two', callout: false };
  if (count === 3) return { text: entry, size: 'three', callout: false };
  const lines = twoLines(Array.from(count <= 6 ? entry : start(5)));
  const longest = Math.max(...lines.map((line) => line.length));
  return {
    text: lines.map((line) => line.join('')).join('\n'),
    size: longest > 3 ? 'linesNarrow' : 'lines',
    callout: true,
  };
}

/** The most characters on a line when breaking two-line text at a space. */
const MAX_LINE_AT_SPACE = 4;

function twoLines(characters: readonly string[]): [string[], string[]] {
  let best: [string[], string[]] | null = null;
  characters.forEach((character, i) => {
    if (character !== ' ') return;
    const first = characters.slice(0, i);
    const second = characters.slice(i + 1);
    if (first.length > MAX_LINE_AT_SPACE || second.length > MAX_LINE_AT_SPACE) return;
    const imbalance = Math.abs(first.length - second.length);
    // Ties go to the later space, so the top line is the longer one.
    if (!best || imbalance <= Math.abs(best[0].length - best[1].length)) best = [first, second];
  });
  if (best) return best;
  const middle = Math.ceil(characters.length / 2);
  return [characters.slice(0, middle), characters.slice(middle)];
}
