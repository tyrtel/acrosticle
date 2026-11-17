import type { CrosswordResult } from './file';
import type { Crossword, CrosswordClue, CrosswordSquare } from './puzzle';
import { MAX_CROSSWORD_SIZE } from './puzzle';

const MAGIC = 'ACROSS&DOWN\0';
const MAGIC_OFFSET = 0x02;
const VERSION_OFFSET = 0x18;
const WIDTH_OFFSET = 0x2c;
const HEIGHT_OFFSET = 0x2d;
const CLUE_COUNT_OFFSET = 0x2e;
const SCRAMBLED_OFFSET = 0x32;
const GRID_OFFSET = 0x34;
const BLOCK = '.';
const CIRCLED_FLAG = 0x80;

/**
 * Reads an Across Lite .puz file, the common format crosswords are shared in.
 * Keeps the answers (unless the file scrambles them), rebus squares and
 * circled squares. Clue numbers come from the grid, as the format intends.
 */
export function crosswordFromPuz(bytes: Uint8Array): CrosswordResult {
  if (bytes.length < GRID_OFFSET || ascii(bytes, MAGIC_OFFSET, MAGIC.length) !== MAGIC) {
    return { ok: false, error: "This isn't a .puz crossword file." };
  }
  const width = bytes[WIDTH_OFFSET] ?? 0;
  const height = bytes[HEIGHT_OFFSET] ?? 0;
  const clueCount = u16(bytes, CLUE_COUNT_OFFSET);
  const scrambled = u16(bytes, SCRAMBLED_OFFSET) !== 0;
  if (width === 0 || height === 0 || width > MAX_CROSSWORD_SIZE || height > MAX_CROSSWORD_SIZE) {
    return { ok: false, error: `The grid size (${width}×${height}) isn't supported.` };
  }
  const count = width * height;
  const stringsStart = GRID_OFFSET + 2 * count;
  if (bytes.length < stringsStart) return { ok: false, error: 'The .puz file is cut short.' };

  // Version 2.0 files store text as UTF-8; older ones as Latin-1.
  const encoding = ascii(bytes, VERSION_OFFSET, 1) === '2' ? 'utf-8' : 'latin1';
  const decoder = new TextDecoder(encoding);
  const decode = (data: Uint8Array) => decoder.decode(data);
  let offset = stringsStart;
  const nextString = (): string | null => {
    const end = bytes.indexOf(0, offset);
    if (end === -1) return null;
    const text = decode(bytes.subarray(offset, end));
    offset = end + 1;
    return text;
  };
  const title = nextString();
  const author = nextString();
  const copyright = nextString();
  const clueTexts: string[] = [];
  for (let i = 0; i < clueCount; i++) {
    const text = nextString();
    if (text === null) return { ok: false, error: 'The .puz file has fewer clues than it says.' };
    clueTexts.push(text);
  }
  const notes = nextString();
  const sections = readSections(bytes, offset);

  const rebusGrid = sections.get('GRBS');
  const rebusTable = parseRebusTable(sections.get('RTBL'), decode);
  const extras = sections.get('GEXT');
  const squares: CrosswordSquare[] = [];
  for (let i = 0; i < count; i++) {
    const char = String.fromCharCode(bytes[GRID_OFFSET + i] ?? 0);
    if (char === BLOCK) {
      squares.push({ kind: 'block' });
      continue;
    }
    const rebusKey = rebusGrid?.[i];
    const rebus = rebusKey ? rebusTable.get(rebusKey - 1) : undefined;
    squares.push({
      kind: 'open',
      solution: scrambled ? null : (rebus ?? char),
      circled: ((extras?.[i] ?? 0) & CIRCLED_FLAG) !== 0,
      shaded: false,
    });
  }

  const clues = assignClues(width, height, squares, clueTexts);
  if (!clues) return { ok: false, error: "The clues don't match the grid." };
  const crossword: Crossword = {
    ...(title && { title }),
    ...(author && { author }),
    ...(copyright && { copyright }),
    ...(notes && { notes }),
    width,
    height,
    squares,
    clues,
  };
  return { ok: true, crossword };
}

/**
 * .puz lists clues in grid order, across before down at each numbered square;
 * numbering them means walking the grid the same way.
 */
function assignClues(
  width: number,
  height: number,
  squares: readonly CrosswordSquare[],
  texts: readonly string[],
): Crossword['clues'] | null {
  const open = (row: number, column: number) =>
    row >= 0 &&
    row < height &&
    column >= 0 &&
    column < width &&
    squares[row * width + column]?.kind === 'open';
  const across: CrosswordClue[] = [];
  const down: CrosswordClue[] = [];
  let number = 1;
  let next = 0;
  for (let row = 0; row < height; row++) {
    for (let column = 0; column < width; column++) {
      if (!open(row, column)) continue;
      const startsAcross = !open(row, column - 1) && open(row, column + 1);
      const startsDown = !open(row - 1, column) && open(row + 1, column);
      if (!startsAcross && !startsDown) continue;
      if (startsAcross) across.push({ number, text: texts[next++] ?? '' });
      if (startsDown) down.push({ number, text: texts[next++] ?? '' });
      number++;
    }
  }
  return next === texts.length ? { across, down } : null;
}

/** Extra sections after the clues: a 4-letter name, length, checksum, data, then a 0 byte. */
function readSections(bytes: Uint8Array, start: number): Map<string, Uint8Array> {
  const sections = new Map<string, Uint8Array>();
  let offset = start;
  while (offset + 8 <= bytes.length) {
    const name = ascii(bytes, offset, 4);
    const length = u16(bytes, offset + 4);
    const dataStart = offset + 8;
    if (!/^[A-Z]{4}$/.test(name) || dataStart + length > bytes.length) break;
    sections.set(name, bytes.subarray(dataStart, dataStart + length));
    offset = dataStart + length + 1;
  }
  return sections;
}

/** RTBL: " 0:HEART; 1:DIAMOND;" (keys may be padded with a space). */
function parseRebusTable(
  data: Uint8Array | undefined,
  decode: (data: Uint8Array) => string,
): Map<number, string> {
  const table = new Map<number, string>();
  if (!data) return table;
  for (const entry of decode(data).split(';')) {
    const match = /^\s*(\d+):(.+)$/.exec(entry);
    if (match?.[1] && match[2]) table.set(Number(match[1]), match[2]);
  }
  return table;
}

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(offset, offset + length));
}

function u16(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] ?? 0) | ((bytes[offset + 1] ?? 0) << 8);
}
