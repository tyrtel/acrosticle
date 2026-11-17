import { parseCrosswordFile } from '@gridicles/protocol';
import type { Crossword } from '@gridicles/crossword';
import { ImageUpload } from '../../components/ImageUpload';
import { CROSSWORD_MIN_EDGE, downscaleImage, MAX_IMAGE_EDGE } from '../../lib/downscale';

/** Scales big photos down and small screenshots up (see CROSSWORD_MIN_EDGE). */
const prepareCrossword = (file: File) => downscaleImage(file, MAX_IMAGE_EDGE, CROSSWORD_MIN_EDGE);
import { parseCrosswordImage } from './parseApi';

export interface UploadCrosswordProps {
  /** Called with the draft and what Claude was unsure of, for the editor. */
  readonly onParsed: (draft: { crossword: Crossword; notes: readonly string[] }) => void;
  readonly prepare?: (file: File) => Promise<Blob>;
}

/** Upload one photo of a crossword (grid and clues, or just the grid); Claude reads it for the editor. */
export function UploadCrossword({ onParsed, prepare }: UploadCrosswordProps) {
  return (
    <ImageUpload
      heading="Upload a crossword photo"
      intro="One clear photo, scan or screenshot of the grid, ideally with its clues (combine pages into one image first). Standard, barred and rows-and-columns grids all work. Claude reads it, then you check everything in the editor."
      read={parseCrosswordImage}
      onRead={(result) => {
        const crossword = parseCrosswordFile(result.file);
        if (!crossword.ok) return `The crossword couldn't be read: ${crossword.error}`;
        onParsed({ crossword: crossword.value, notes: result.notes });
        return undefined;
      }}
      prepare={prepare ?? prepareCrossword}
    />
  );
}
