import { describe, expect, it } from 'vitest';
import mini from '../../../../../samples/puzzles/gridicles-mini-1.json';
import { readCrosswordFile, readCrosswordText } from './readCrosswordFile';

const bytes = (text: string) => new TextEncoder().encode(text);

describe('readCrosswordFile', () => {
  it('reads our JSON format', () => {
    const result = readCrosswordFile('mini.json', bytes(JSON.stringify(mini)));
    expect(result.ok && result.crossword.title).toBe('Gridicles Mini No. 1');
  });

  it('reads .ipuz', () => {
    const ipuz = {
      kind: ['http://ipuz.org/crossword#1'],
      dimensions: { width: 2, height: 1 },
      puzzle: [[1, 0]],
      clues: { Across: [[1, 'Hi']] },
    };
    const result = readCrosswordText(JSON.stringify(ipuz));
    expect(result.ok && result.crossword.clues.across).toEqual([{ number: 1, text: 'Hi' }]);
  });

  it('reads .puz by its name, and reports a bad one', () => {
    expect(readCrosswordFile('broken.PUZ', bytes('nope'))).toEqual({
      ok: false,
      error: "This isn't a .puz crossword file.",
    });
  });

  it('reports text that is neither', () => {
    expect(readCrosswordText('{nope')).toEqual({
      ok: false,
      error: "That isn't a .puz file or valid JSON.",
    });
    expect(readCrosswordText(JSON.stringify({ ...mini, grid: ['AB', 'C'] }))).toEqual({
      ok: false,
      error: 'Row 2 has 1 squares, but row 1 has 2.',
    });
  });
});
