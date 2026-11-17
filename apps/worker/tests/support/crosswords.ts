import type { PuzzleFile } from '@gridicles/protocol';
import mini from '../../../../samples/puzzles/gridicles-mini-1.json';

export const CROSSWORD_BASE = 'https://crosswordicle.test';

/** The sample mini crossword (cells 4, 5, 10, 16, 21 and 22 are black). */
export const miniCrosswordFile = mini as PuzzleFile;
