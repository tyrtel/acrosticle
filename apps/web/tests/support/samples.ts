import sample from '../../../../samples/puzzles/diplo-crostic-37.json';

/** The sample puzzle file as printed in the magazine, with its misprint put back. */
export function samplePuzzleFileAsPrinted(): typeof sample {
  return {
    ...sample,
    grid: {
      ...sample.grid,
      rows: sample.grid.rows.map((row) =>
        sample.errata.reduce(
          (r, e) => r.replace(new RegExp(`\\b${e.corrected}\\b`), e.printed),
          row,
        ),
      ),
    },
  };
}
