import { PuzzleFile, type SampleId } from '@acrosticle/protocol';
import diploCrostic37 from '../../../samples/puzzles/diplo-crostic-37.json';

/**
 * The server's own copies of the built-in samples. Anonymous visitors may
 * start rooms for these, so the puzzle never comes from the client.
 */
export const SAMPLE_PUZZLES: Readonly<Record<SampleId, PuzzleFile>> = {
  'diplo-crostic-37': PuzzleFile.parse(diploCrostic37),
};
