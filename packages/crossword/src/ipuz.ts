import type { CrosswordResult } from './file';
import type { Crossword, CrosswordClue, CrosswordSquare } from './puzzle';
import { MAX_CROSSWORD_SIZE } from './puzzle';

type Json = unknown;

/**
 * Reads an .ipuz crossword (the open JSON format). Handles the common shapes:
 * cells as numbers, strings or `{ cell, style }` objects; answers as strings
 * or `{ value }`; clues as `[number, text]` or `{ number, clue }`. Clue
 * numbers come from the grid, so the file's own numbering isn't trusted.
 */
export function crosswordFromIpuz(data: Json): CrosswordResult {
  if (!isRecord(data)) return { ok: false, error: "This isn't an .ipuz file." };
  const kinds = data.kind;
  if (
    Array.isArray(kinds) &&
    !kinds.some((k) => typeof k === 'string' && k.includes('crossword'))
  ) {
    return { ok: false, error: "This .ipuz file isn't a crossword." };
  }
  const dimensions = isRecord(data.dimensions) ? data.dimensions : {};
  const width = Number(dimensions.width);
  const height = Number(dimensions.height);
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    return { ok: false, error: 'The .ipuz file has no grid size.' };
  }
  if (width > MAX_CROSSWORD_SIZE || height > MAX_CROSSWORD_SIZE) {
    return { ok: false, error: `The grid size (${width}×${height}) isn't supported.` };
  }
  const puzzle = Array.isArray(data.puzzle) ? data.puzzle : null;
  if (!puzzle || puzzle.length !== height)
    return { ok: false, error: 'The .ipuz grid is missing rows.' };
  const solution = Array.isArray(data.solution) ? data.solution : [];
  const block = typeof data.block === 'string' ? data.block : '#';

  const squares: CrosswordSquare[] = [];
  const bars = { right: new Set<number>(), bottom: new Set<number>() };
  for (let row = 0; row < height; row++) {
    const cells: Json[] = Array.isArray(puzzle[row]) ? (puzzle[row] as Json[]) : [];
    if (cells.length !== width)
      return { ok: false, error: `Row ${row + 1} of the .ipuz grid isn't ${width} wide.` };
    const answers: Json[] = Array.isArray(solution[row]) ? (solution[row] as Json[]) : [];
    for (let column = 0; column < width; column++) {
      squares.push(readSquare(cells[column], answers[column], block));
      readBars(cells[column], row, column, width, bars);
    }
  }

  const clueGroups = isRecord(data.clues) ? data.clues : {};
  const group = (name: string): CrosswordClue[] => {
    const key = Object.keys(clueGroups).find((k) => k.split(':')[0]?.trim().toLowerCase() === name);
    const list = key === undefined ? [] : clueGroups[key];
    return Array.isArray(list) ? list.flatMap(readClue) : [];
  };

  const crossword: Crossword = {
    ...text(data, 'title'),
    ...text(data, 'author'),
    ...text(data, 'copyright'),
    ...text(data, 'notes'),
    ...(bars.right.size + bars.bottom.size > 0 && {
      bars: {
        right: [...bars.right].sort((a, b) => a - b),
        bottom: [...bars.bottom].sort((a, b) => a - b),
      },
    }),
    width,
    height,
    squares,
    clues: { across: group('across'), down: group('down') },
  };
  return { ok: true, crossword };
}

function readSquare(cell: Json, answer: Json, block: string): CrosswordSquare {
  const value = isRecord(cell) ? cell.cell : cell;
  if (value === null || value === block || (isRecord(cell) && cell.cell === block))
    return { kind: 'block' };
  const style = isRecord(cell) && isRecord(cell.style) ? cell.style : {};
  const raw = isRecord(answer) ? answer.value : answer;
  const solution =
    typeof raw === 'string' && raw !== block && raw.trim() !== '' ? raw.trim() : null;
  return {
    kind: 'open',
    solution,
    circled: style.shapebg === 'circle',
    shaded: Boolean(style.highlight) || typeof style.color === 'string',
  };
}

/** .ipuz bars: a cell style's "barred" holds T, R, B and/or L for the edges with a bar. */
function readBars(
  cell: Json,
  row: number,
  column: number,
  width: number,
  bars: { right: Set<number>; bottom: Set<number> },
): void {
  const style = isRecord(cell) && isRecord(cell.style) ? cell.style : {};
  if (typeof style.barred !== 'string') return;
  const cellNumber = row * width + column + 1;
  const edges = style.barred.toUpperCase();
  if (edges.includes('R')) bars.right.add(cellNumber);
  if (edges.includes('B')) bars.bottom.add(cellNumber);
  if (edges.includes('L') && column > 0) bars.right.add(cellNumber - 1);
  if (edges.includes('T') && row > 0) bars.bottom.add(cellNumber - width);
}

function readClue(entry: Json): CrosswordClue[] {
  if (Array.isArray(entry) && entry.length >= 2) {
    const number = Number(entry[0]);
    return Number.isInteger(number) ? [{ number, text: plain(String(entry[1])) }] : [];
  }
  if (isRecord(entry)) {
    const number = Number(entry.number);
    const clue = entry.clue ?? entry.text;
    return Number.isInteger(number) && typeof clue === 'string'
      ? [{ number, text: plain(clue) }]
      : [];
  }
  return [];
}

function text(data: Record<string, Json>, key: 'title' | 'author' | 'copyright' | 'notes') {
  const value = data[key];
  return typeof value === 'string' && value.trim() !== '' ? { [key]: plain(value) } : {};
}

/** .ipuz text may carry simple HTML (<i>, <b>, entities); keep the words. */
function plain(value: string): string {
  return value
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function isRecord(value: Json): value is Record<string, Json> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
