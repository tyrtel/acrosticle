import type { Puzzle } from '@acrosticle/core';
import { parsePuzzleFile } from '@acrosticle/protocol';
import diploCrostic37 from '../../../../samples/puzzles/diplo-crostic-37.json';

/** The bundled public-domain sample puzzle, for "Try the sample puzzle". */
export function loadSamplePuzzle(): Puzzle {
  const result = parsePuzzleFile(diploCrostic37);
  if (!result.ok) throw new Error(`Bundled sample puzzle is invalid: ${result.error}`);
  return result.value;
}
