import type { PuzzleKind, SampleId } from '@gridicles/protocol';

/**
 * Which site this build is: the same app is built twice (see vite.config.ts),
 * as Acrosticle for acrostics and as Crosswordicle for crosswords.
 */
export interface Site {
  readonly kind: PuzzleKind;
  readonly name: string;
  readonly tagline: string;
  readonly sample: SampleId;
}

export const SITES: Readonly<Record<PuzzleKind, Site>> = {
  acrostic: {
    kind: 'acrostic',
    name: 'Acrosticle',
    tagline: 'Solve acrostic puzzles together, in real time.',
    sample: 'diplo-crostic-37',
  },
  crossword: {
    kind: 'crossword',
    name: 'Crosswordicle',
    tagline: 'Solve crosswords together, in real time.',
    sample: 'gridicles-mini-1',
  },
};

/** The site for a build setting (VITE_SITE); anything but "crossword" is Acrosticle. */
export function siteFor(setting: string | undefined): Site {
  return setting === 'crossword' ? SITES.crossword : SITES.acrostic;
}

export const SITE: Site = siteFor(import.meta.env.VITE_SITE as string | undefined);
