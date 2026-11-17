import { describe, expect, it } from 'vitest';
import { mini } from '../tests/support/mini';
import { crosswordFromIpuz } from './ipuz';

const miniIpuz = () => ({
  version: 'http://ipuz.org/v2',
  kind: ['http://ipuz.org/crossword#1'],
  title: 'Gridicles Mini No. 1',
  author: 'Gridicles',
  dimensions: { width: 5, height: 5 },
  puzzle: [
    [1, 2, 3, '#', '#'],
    [4, 0, 0, 5, '#'],
    [6, 0, 0, 0, 7],
    ['#', 8, 0, 0, 0],
    ['#', '#', 9, 0, 0],
  ],
  solution: [
    ['G', 'A', 'S', '#', '#'],
    ['A', 'B', 'L', 'E', '#'],
    ['S', 'L', 'A', 'T', 'E'],
    ['#', 'E', 'T', 'N', 'A'],
    ['#', '#', 'E', 'A', 'R'],
  ],
  clues: {
    Across: [
      [1, 'Fuel at the pump'],
      [4, 'Capable'],
      [6, 'Roofing stone'],
      [8, 'Sicilian volcano'],
      [9, 'Corn unit'],
    ],
    Down: [
      [1, "Laughing ___ (dentist's aid)"],
      [2, '___-bodied seaman'],
      [3, 'Clean ___ (fresh start)'],
      [5, 'Mount near Catania'],
      [7, 'It hears'],
    ],
  },
});

describe('crosswordFromIpuz', () => {
  it('reads the sample', () => {
    expect(crosswordFromIpuz(miniIpuz())).toEqual({ ok: true, crossword: mini() });
  });

  it('reads cell objects, answer objects, styles, object clues and simple HTML', () => {
    const data = miniIpuz();
    data.puzzle[0] = [
      { cell: 1, style: { shapebg: 'circle' } },
      2,
      { cell: 3, style: { highlight: true } },
      '#',
      '#',
    ] as never;
    data.solution[2] = [{ value: 'S' }, 'L', { value: 'HEART' }, 'T', 'E'] as never;
    data.clues = {
      'Across:Across': [{ number: 1, clue: '<i>Fuel</i> &amp; more' }],
      Down: [{ number: '2', clue: 'Two' }],
    } as never;
    const result = crosswordFromIpuz(data);
    if (!result.ok) throw new Error(result.error);
    expect(result.crossword.squares[0]).toMatchObject({ circled: true, shaded: false });
    expect(result.crossword.squares[2]).toMatchObject({ circled: false, shaded: true });
    expect(result.crossword.squares[12]).toMatchObject({ solution: 'HEART' });
    expect(result.crossword.clues).toEqual({
      across: [{ number: 1, text: 'Fuel & more' }],
      down: [{ number: 2, text: 'Two' }],
    });
  });

  it('treats null cells as black squares and missing answers as unknown', () => {
    const data = { ...miniIpuz(), solution: undefined };
    data.puzzle[0] = [1, 2, 3, null, null] as never;
    const result = crosswordFromIpuz(data);
    if (!result.ok) throw new Error(result.error);
    expect(result.crossword.squares[3]).toEqual({ kind: 'block' });
    expect(result.crossword.squares[0]).toMatchObject({ solution: null });
  });

  it.each([
    ['not an object', [], /isn't an \.ipuz/],
    [
      'another puzzle kind',
      { ...miniIpuz(), kind: ['http://ipuz.org/sudoku#1'] },
      /isn't a crossword/,
    ],
    ['no size', { ...miniIpuz(), dimensions: undefined }, /no grid size/],
    [
      'an oversized grid',
      { ...miniIpuz(), dimensions: { width: 50, height: 5 } },
      /isn't supported/,
    ],
    ['missing rows', { ...miniIpuz(), puzzle: [[1]] }, /missing rows/],
    ['a short row', { ...miniIpuz(), puzzle: [[1], [], [], [], []] }, /Row 1 .* isn't 5 wide/],
  ])('rejects %s', (_label, data, error) => {
    const result = crosswordFromIpuz(data);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(error);
  });
});
