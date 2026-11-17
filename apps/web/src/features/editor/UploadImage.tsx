import type { Puzzle } from '@gridicles/acrostic';
import { parseAcrosticFile } from '@gridicles/protocol';
import { ImageUpload } from '../../components/ImageUpload';
import { parseImage } from './parseApi';

export interface ParsedImage {
  readonly puzzle: Puzzle;
  /** What Claude was unsure about. */
  readonly notes: readonly string[];
}

export interface UploadImageProps {
  readonly onParsed: (result: ParsedImage) => void;
  /** Prepares the image before upload (default: scale down to Claude's size limit). */
  readonly prepare?: (file: File) => Promise<Blob>;
}

/** Upload a photo or scan of an acrostic; Claude reads it into a draft to review. */
export function UploadImage({ onParsed, prepare }: UploadImageProps) {
  return (
    <ImageUpload
      heading="Upload a puzzle image"
      intro="A clear scan or screenshot of the whole puzzle works best. Claude reads the grid and clues, then you check them before solving."
      read={parseImage}
      onRead={(result) => {
        const puzzle = parseAcrosticFile(result.file);
        if (!puzzle.ok) return 'The server sent an unexpected response.';
        onParsed({ puzzle: puzzle.value, notes: result.notes });
        return undefined;
      }}
      {...(prepare && { prepare })}
    />
  );
}
