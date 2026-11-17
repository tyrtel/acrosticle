import { PuzzleFile, type SampleId } from '@gridicles/protocol';
import diploCrostic37 from '../../../samples/puzzles/diplo-crostic-37.json';
import gridiclesBarred1 from '../../../samples/puzzles/gridicles-barred-1.json';
import gridiclesMini1 from '../../../samples/puzzles/gridicles-mini-1.json';
import gridiclesRows1 from '../../../samples/puzzles/gridicles-rows-1.json';

/**
 * The server's own copies of the built-in samples. Anonymous visitors may
 * start rooms for these, so the puzzle never comes from the client.
 */
export const SAMPLE_PUZZLES: Readonly<Record<SampleId, PuzzleFile>> = {
  'diplo-crostic-37': PuzzleFile.parse(diploCrostic37),
  'gridicles-mini-1': PuzzleFile.parse(gridiclesMini1),
  'gridicles-barred-1': PuzzleFile.parse(gridiclesBarred1),
  'gridicles-rows-1': PuzzleFile.parse(gridiclesRows1),
};
