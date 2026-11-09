import { describe, expect, it } from 'vitest';
import { describePeers, initials, readableTextColor } from './peers';

describe('initials', () => {
  it.each([
    ['Ada Lovelace', 'AL'],
    ['ada', 'A'],
    ['  bo  ', 'B'],
    ['Mary Ann Evans', 'ME'],
    ['', '?'],
    ['   ', '?'],
  ])('%j -> %s', (name, expected) => {
    expect(initials(name)).toBe(expected);
  });
});

describe('readableTextColor', () => {
  it.each([
    ['#000000', '#ffffff'],
    ['#ffffff', '#000000'],
    ['#7b2cbf', '#ffffff'],
    ['#f4a259', '#000000'],
    ['not-a-color', '#ffffff'],
  ])('on %s use %s', (background, expected) => {
    expect(readableTextColor(background)).toBe(expected);
  });
});

describe('describePeers', () => {
  const peer = (name: string) => ({ id: name, name, color: '#000000' });

  it.each([
    [[], ''],
    [[peer('Bo')], 'Bo is here'],
    [[peer('Bo'), peer('Cy')], 'Bo and Cy are here'],
    [[peer('Bo'), peer('Cy'), peer('Di')], 'Bo, Cy and Di are here'],
  ])('%#', (peers, expected) => {
    expect(describePeers(peers)).toBe(expected);
  });
});
