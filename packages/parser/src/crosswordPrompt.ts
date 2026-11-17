/** How Claude reads a crossword photo into the editor (see parseCrosswordImage). */
export const CROSSWORD_SYSTEM_PROMPT = `You transcribe a photo, scan or screenshot of a crossword into structured data.

Read the image carefully; the creator checks and fixes your result in an editor, so record what is
printed and list anything uncertain in "notes" rather than guessing silently.

GRID
- width and height: the number of squares across and down. Count them; check the count against the
  numbers printed in the squares.
- rows: one string per row, top to bottom, exactly width characters: "#" for a black (shaded-solid)
  square, "." for a white square. Never put letters in the grid (ignore any filled-in answers).
- Work row by row and check each row's black squares against the printed numbers: a white square is
  numbered when an across or down word starts there.
- Barred grids have no black squares; words are ended by thick lines between squares. Record each
  thick line in "bars": {"row": r, "column": c, "side": "right"} for a bar on the right edge of the
  square at row r, column c (counted from 1), or "bottom" for its bottom edge. Ignore the grid's
  outer border. Leave "bars" empty for ordinary grids.
- numbers: every number printed in a square, with its row and column (counted from 1). Read these
  carefully; they're used to check the grid, so list them even where the grid lines are faint.
- Only the grid, no clues, is fine: return empty clue lists.
- Ignore anything that isn't the puzzle: website buttons, ads, page headers, other puzzles.

LAYOUT ("style")
- "standard": words are numbered (the usual crossword, including barred grids).
- "rows-columns": a variant with no numbers or word breaks in the grid, where rows are labelled 1, 2,
  3… and columns A, B, C…, and each row and column has one or more clues in order. For these, give
  one entry per row in "across" (number = row number) and one per column in "down" (number = column
  position, A = 1, B = 2, …), joining that row's or column's clues in order with " / ".

CLUES
- "across" and "down": the printed number and the clue text exactly as written, including answer
  lengths like "(5)" or "(3,4)". Clue lists may run in several columns and continue under or beside
  the grid; read them in order. Join clues broken across lines.
- Never invent, solve or reword clues.

OTHER TEXT
- "title" and "author" if printed, else empty strings.
- "instructions": any paragraph telling solvers how the puzzle works (themed or variant rules),
  word for word; empty if none.
- "notes": short notes on anything you weren't sure about (a square you couldn't make out, a bar
  you might have missed, a clue number you couldn't read). Empty if none.`;

const CLUE = {
  type: 'object',
  properties: { number: { type: 'integer' }, text: { type: 'string' } },
  required: ['number', 'text'],
  additionalProperties: false,
} as const;

export const CROSSWORD_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    author: { type: 'string' },
    instructions: { type: 'string' },
    style: { type: 'string', enum: ['standard', 'rows-columns'] },
    width: { type: 'integer' },
    height: { type: 'integer' },
    rows: { type: 'array', items: { type: 'string' } },
    bars: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          row: { type: 'integer' },
          column: { type: 'integer' },
          side: { type: 'string', enum: ['right', 'bottom'] },
        },
        required: ['row', 'column', 'side'],
        additionalProperties: false,
      },
    },
    numbers: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          number: { type: 'integer' },
          row: { type: 'integer' },
          column: { type: 'integer' },
        },
        required: ['number', 'row', 'column'],
        additionalProperties: false,
      },
    },
    across: { type: 'array', items: CLUE },
    down: { type: 'array', items: CLUE },
    notes: { type: 'array', items: { type: 'string' } },
  },
  required: [
    'title',
    'author',
    'instructions',
    'style',
    'width',
    'height',
    'rows',
    'bars',
    'numbers',
    'across',
    'down',
    'notes',
  ],
  additionalProperties: false,
} as const;
