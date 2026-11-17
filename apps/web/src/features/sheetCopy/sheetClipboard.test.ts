import { describe, expect, it } from 'vitest';
import { a1, sheetClipboard } from './sheetClipboard';
import type { SheetCell, SheetLayout } from './sheetLayout';

const cell = (overrides: Partial<SheetCell> & Pick<SheetCell, 'kind'>): SheetCell => ({
  text: '',
  ...overrides,
});

// Row 0: a merged clue over two columns, then an answer letter.
// Row 1: covered, covered, and a letter square copying the answer letter.
const layout: SheetLayout = {
  rows: [
    [
      cell({ kind: 'clue', text: 'A. <Fish> & "chips"', columnSpan: 2 }),
      null,
      cell({ kind: 'answer', text: 'Q', marked: true }),
    ],
    [
      cell({ kind: 'block' }),
      cell({ kind: 'empty' }),
      cell({ kind: 'letter', text: 'Q', copies: { row: 0, column: 2 } }),
    ],
  ],
};

/** The <td> elements of the copied HTML, read back the way a paste target would. */
function cells(html: string): HTMLTableCellElement[] {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return [...doc.querySelectorAll('td')];
}

describe('sheetClipboard', () => {
  const { html, text } = sheetClipboard(layout);

  it('marks the HTML as Sheets data and suggests narrow columns and even rows', () => {
    expect(html.startsWith('<google-sheets-html-origin><table')).toBe(true);
    const doc = new DOMParser().parseFromString(html, 'text/html');
    expect([...doc.querySelectorAll('col')].map((col) => col.getAttribute('width'))).toEqual([
      '28',
      '28',
      '28',
    ]);
    expect([...doc.querySelectorAll('tr')].map((tr) => tr.getAttribute('style'))).toEqual([
      'height:21px',
      'height:21px',
    ]);
  });

  it('writes merges, escaped text and highlight colors', () => {
    const [clue, answer, block, empty] = cells(html);
    expect(clue?.getAttribute('colspan')).toBe('2');
    expect(clue?.textContent).toBe('A. <Fish> & "chips"');
    expect(answer?.getAttribute('style')).toContain('background:#bfe8c4');
    expect(block?.getAttribute('style')).toContain('background:#000');
    expect(empty?.outerHTML).toBe('<td></td>');
    // Covered cells write nothing, so each row adds up to three columns.
    expect(cells(html)).toHaveLength(5);
  });

  it('gives letter squares a relative formula to their answer letter, showing its value', () => {
    const letter = cells(html)[4];
    expect(letter?.getAttribute('data-sheets-formula')).toBe('=R[-1]C[0]');
    expect(letter?.textContent).toBe('Q');
  });

  it('writes tab-separated text with A1 formulas', () => {
    expect(text).toBe('A. <Fish> & "chips"\t\tQ\n\t\t=C1');
  });

  it('keeps typed symbols that would start a formula as text, and flattens tabs and newlines', () => {
    const tricky = sheetClipboard({
      rows: [
        [
          cell({ kind: 'answer', text: '=' }),
          cell({ kind: 'answer', text: '-5' }),
          cell({ kind: 'clue', text: 'a\tb\nc' }),
        ],
      ],
    });
    expect(tricky.text).toBe("'=\t'-5\ta b c");
  });
});

describe('a1', () => {
  it.each([
    [0, 0, 'A1'],
    [4, 25, 'Z5'],
    [0, 26, 'AA1'],
    [9, 51, 'AZ10'],
    [0, 52, 'BA1'],
    [0, 701, 'ZZ1'],
    [0, 702, 'AAA1'],
  ])('row %i, column %i is %s', (row, column, name) => {
    expect(a1({ row, column })).toBe(name);
  });
});
