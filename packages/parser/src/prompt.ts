/**
 * What we ask Claude to return: the puzzle-file shape (compact grid rows keep
 * output tokens, the main cost, low) plus notes on anything uncertain.
 *
 * Structured outputs don't support numeric or length limits, so the schema
 * only fixes the shape; validatePuzzle checks the content afterwards.
 */
export const EXTRACTION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'constructedBy', 'columns', 'rows', 'clues', 'notes'],
  properties: {
    title: { anyOf: [{ type: 'string' }, { type: 'null' }] },
    constructedBy: { anyOf: [{ type: 'string' }, { type: 'null' }] },
    columns: { type: 'integer' },
    rows: { type: 'array', items: { type: 'string' } },
    clues: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['label', 'text', 'cells'],
        properties: {
          label: { type: 'string' },
          text: { type: 'string' },
          cells: { type: 'array', items: { type: 'integer' } },
        },
      },
    },
    notes: { type: 'array', items: { type: 'string' } },
  },
} as const;

/** Stable instructions (cached). Short and literal: read, don't solve. */
export const SYSTEM_PROMPT = `You transcribe printed acrostic puzzles from images into structured data.
Transcribe exactly what is printed. Never solve the puzzle, and never correct apparent misprints.

The image shows a quotation grid of numbered squares and a list of lettered clues, each with numbered answer blanks.

- title and constructedBy: as printed, or null if absent.
- columns: the number of squares across one full row of the grid.
- rows: one string per grid row, top to bottom. Each string lists that row's squares left to right, separated by single spaces:
  - a letter square as its number followed by its clue letter(s), e.g. 26A or 140AA
  - a black square as #
  - a printed punctuation square as that single character
  Every row has exactly \`columns\` squares, except that the last row may be shorter.
- clues: in label order (A, B, C, ...). For each: label; text exactly as printed (write a printed blank line as ____); cells: every blank's number in order, joining blanks that continue onto the following line.
- Use context for look-alike characters (O/0/Q/D, I/1/l): square numbers increase by one in reading order, and clue labels are letters.
- notes: anything you were unsure about, briefly. An empty list if nothing.`;
