import type { Crossword, CrosswordClue, CrosswordSquare, CrosswordStyle } from './puzzle';
import { cellOf, MAX_CROSSWORD_SIZE } from './puzzle';

/**
 * Our crossword file format: how crosswords are stored, exported and kept as
 * samples. Each grid row is a string with one character per square: `#` for a
 * black square, `.` for an open square with no known answer, or the answer's
 * letter. Longer answers (rebus squares) go in `rebus`, keyed by cell number.
 */
export interface CrosswordFileData {
  readonly title?: string | undefined;
  readonly author?: string | undefined;
  readonly copyright?: string | undefined;
  readonly notes?: string | undefined;
  readonly grid: readonly string[];
  readonly rebus?: Readonly<Record<string, string>> | undefined;
  readonly circled?: readonly number[] | undefined;
  readonly shaded?: readonly number[] | undefined;
  /** Standard unless set (see `CrosswordStyle`). */
  readonly style?: CrosswordStyle | undefined;
  /** Cells with a bar on their right / bottom edge (barred grids). */
  readonly bars?:
    { readonly right?: readonly number[]; readonly bottom?: readonly number[] } | undefined;
  readonly clues: {
    readonly across: readonly CrosswordClue[];
    readonly down: readonly CrosswordClue[];
  };
}

export type CrosswordResult =
  | { readonly ok: true; readonly crossword: Crossword }
  | { readonly ok: false; readonly error: string };

const BLOCK = '#';
const UNKNOWN = '.';

/** Reads our file format into a crossword. Checks shape; run `validateCrossword` for the rest. */
export function crosswordFromFile(file: CrosswordFileData): CrosswordResult {
  const rows = file.grid.map((row) => Array.from(row));
  const height = rows.length;
  const width = rows[0]?.length ?? 0;
  if (height === 0 || width === 0) return { ok: false, error: 'The grid is empty.' };
  if (width > MAX_CROSSWORD_SIZE || height > MAX_CROSSWORD_SIZE) {
    return {
      ok: false,
      error: `The grid is ${width}×${height}; the most is ${MAX_CROSSWORD_SIZE}×${MAX_CROSSWORD_SIZE}.`,
    };
  }
  const uneven = rows.findIndex((row) => row.length !== width);
  if (uneven !== -1) {
    return {
      ok: false,
      error: `Row ${uneven + 1} has ${rows[uneven]?.length} squares, but row 1 has ${width}.`,
    };
  }

  const count = width * height;
  const circled = new Set(file.circled ?? []);
  const shaded = new Set(file.shaded ?? []);
  const rebus = new Map(
    Object.entries(file.rebus ?? {}).map(([cell, value]) => [Number(cell), value]),
  );
  const bars = { right: [...(file.bars?.right ?? [])], bottom: [...(file.bars?.bottom ?? [])] };
  for (const cell of [...circled, ...shaded, ...rebus.keys(), ...bars.right, ...bars.bottom]) {
    if (!Number.isInteger(cell) || cell < 1 || cell > count) {
      return { ok: false, error: `Square ${cell} is outside the ${width}×${height} grid.` };
    }
  }

  const squares: CrosswordSquare[] = rows.flat().map((char, i) => {
    const cell = cellOf(i);
    if (char === BLOCK) return { kind: 'block' };
    const solution = rebus.get(cell) ?? (char === UNKNOWN ? null : char);
    return { kind: 'open', solution, circled: circled.has(cell), shaded: shaded.has(cell) };
  });
  for (const cell of [...circled, ...shaded, ...rebus.keys()]) {
    if (squares[cell - 1]?.kind === 'block') {
      return {
        ok: false,
        error: `Square ${cell} is a black square, so it can't be circled, shaded or a rebus.`,
      };
    }
  }

  return {
    ok: true,
    crossword: {
      ...optional(file),
      ...(file.style === 'rows-columns' && { style: 'rows-columns' as const }),
      ...(bars.right.length + bars.bottom.length > 0 && { bars }),
      width,
      height,
      squares,
      clues: { across: file.clues.across, down: file.clues.down },
    },
  };
}

/** Writes a crossword in our file format (the inverse of `crosswordFromFile`). */
export function crosswordToFile(crossword: Crossword): CrosswordFileData {
  const grid: string[] = [];
  const rebus: Record<string, string> = {};
  const circled: number[] = [];
  const shaded: number[] = [];
  crossword.squares.forEach((square, i) => {
    const row = Math.floor(i / crossword.width);
    let char = BLOCK;
    if (square.kind === 'open') {
      const cell = cellOf(i);
      if (square.solution !== null && Array.from(square.solution).length > 1) {
        rebus[cell] = square.solution;
        char = Array.from(square.solution)[0] ?? UNKNOWN;
      } else {
        char = square.solution ?? UNKNOWN;
      }
      if (square.circled) circled.push(cell);
      if (square.shaded) shaded.push(cell);
    }
    grid[row] = (grid[row] ?? '') + char;
  });
  return {
    ...optional(crossword),
    grid,
    ...(Object.keys(rebus).length > 0 && { rebus }),
    ...(circled.length > 0 && { circled }),
    ...(shaded.length > 0 && { shaded }),
    ...(crossword.style === 'rows-columns' && { style: 'rows-columns' as const }),
    ...(crossword.bars &&
      crossword.bars.right.length + crossword.bars.bottom.length > 0 && {
        bars: { right: [...crossword.bars.right], bottom: [...crossword.bars.bottom] },
      }),
    clues: crossword.clues,
  };
}

/** The same crossword without its answers: what browsers are sent, so nobody can peek. */
export function withoutSolutions(crossword: Crossword): Crossword {
  return {
    ...crossword,
    squares: crossword.squares.map((square) =>
      square.kind === 'open' ? { ...square, solution: null } : square,
    ),
  };
}

function optional(source: {
  readonly title?: string | undefined;
  readonly author?: string | undefined;
  readonly copyright?: string | undefined;
  readonly notes?: string | undefined;
}) {
  return {
    ...(source.title !== undefined && { title: source.title }),
    ...(source.author !== undefined && { author: source.author }),
    ...(source.copyright !== undefined && { copyright: source.copyright }),
    ...(source.notes !== undefined && { notes: source.notes }),
  };
}
