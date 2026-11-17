import { describe, expect, it } from 'vitest';
import { mini } from '../tests/support/mini';
import { formatClueText, parseClueText } from './clueText';

describe('parseClueText', () => {
  it('reads headed sections in common layouts', () => {
    const text = [
      'ACROSS',
      '1. Fuel at the pump',
      '4) Capable',
      '',
      'Down:',
      '1 Laughing ___',
      '2: ___-bodied seaman',
    ].join('\n');
    expect(parseClueText(text)).toEqual({
      clues: {
        across: [
          { number: 1, text: 'Fuel at the pump' },
          { number: 4, text: 'Capable' },
        ],
        down: [
          { number: 1, text: 'Laughing ___' },
          { number: 2, text: '___-bodied seaman' },
        ],
      },
      problems: [],
    });
  });

  it('reads the direction from the number, with or without headings', () => {
    const { clues } = parseClueText('1A Fuel\n1-Down Laughing ___\n5 down Mount (4)');
    expect(clues.across).toEqual([{ number: 1, text: 'Fuel' }]);
    expect(clues.down).toEqual([
      { number: 1, text: 'Laughing ___' },
      { number: 5, text: 'Mount (4)' },
    ]);
  });

  it('reports lines it cannot read, and keeps the rest', () => {
    const { clues, problems } = parseClueText(
      '1. Before any heading\nACROSS\nno number here\n4. Capable',
    );
    expect(clues.across).toEqual([{ number: 4, text: 'Capable' }]);
    expect(problems).toEqual([
      {
        line: 1,
        text: '1. Before any heading',
        message: 'Line 1 comes before an ACROSS or DOWN heading.',
      },
      { line: 3, text: 'no number here', message: "Line 3 isn't a numbered clue." },
    ]);
  });
});

describe('formatClueText', () => {
  it('writes text that reads back the same', () => {
    const { clues } = mini();
    expect(formatClueText(clues).split('\n').slice(0, 2)).toEqual([
      'ACROSS',
      '1. Fuel at the pump',
    ]);
    expect(parseClueText(formatClueText(clues))).toEqual({ clues, problems: [] });
  });
});
