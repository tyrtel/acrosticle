/** Claude reads images up to 2576 px on the long edge; larger only costs more. */
export const MAX_IMAGE_EDGE = 2576;
/** Images this small (and within the edge limit) are sent as they are. */
const SEND_AS_IS_BYTES = 4 * 1024 * 1024;
const SEND_AS_IS_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Small images are enlarged to this long edge for crosswords: Claude reads the
 * numbers in a small screenshot's squares far better at this size (measured
 * with npm run eval:crossword).
 */
export const CROSSWORD_MIN_EDGE = 1568;

/**
 * The size to scale an image to so its long edge is at most `maxEdge`, and at
 * least `minEdge` (default 0: never upscale).
 */
export function targetSize(
  width: number,
  height: number,
  maxEdge = MAX_IMAGE_EDGE,
  minEdge = 0,
): { width: number; height: number } {
  const longest = Math.max(width, height);
  const scale = longest < minEdge ? minEdge / longest : Math.min(1, maxEdge / longest);
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/**
 * Prepares a chosen image for upload: small enough images go as they are;
 * anything else is redrawn at most `maxEdge` px on the long edge, as JPEG.
 */
export async function downscaleImage(
  file: Blob,
  maxEdge = MAX_IMAGE_EDGE,
  minEdge = 0,
): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  try {
    const size = targetSize(bitmap.width, bitmap.height, maxEdge, minEdge);
    const fits = size.width === bitmap.width && size.height === bitmap.height;
    if (fits && file.size <= SEND_AS_IS_BYTES && SEND_AS_IS_TYPES.includes(file.type)) return file;

    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext('2d');
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, size.width, size.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.9),
    );
    return blob ?? file;
  } finally {
    bitmap.close();
  }
}
