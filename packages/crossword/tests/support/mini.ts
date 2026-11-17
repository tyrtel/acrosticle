import sample from '../../../../samples/puzzles/gridicles-mini-1.json';
import { buildCrosswordIndex, crosswordFromFile, type Crossword } from '../../src';

/**
 * The sample mini, with its cell numbers (position + 1):
 *
 *    1 G   2 A   3 S   4 #   5 #
 *    6 A   7 B   8 L   9 E  10 #
 *   11 S  12 L  13 A  14 T  15 E
 *   16 #  17 E  18 T  19 N  20 A
 *   21 #  22 #  23 E  24 A  25 R
 *
 * Printed numbers: 1 (cell 1), 2 (2), 3 (3), 4 (6), 5 (9), 6 (11), 7 (15), 8 (17), 9 (23).
 */
export function mini(): Crossword {
  const result = crosswordFromFile(sample);
  if (!result.ok) throw new Error(result.error);
  return result.crossword;
}

export const miniIndex = () => buildCrosswordIndex(mini());
