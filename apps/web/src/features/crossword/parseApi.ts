import { ParseCrosswordResponse } from '@gridicles/protocol';
import { request, type ApiResult } from '../../lib/api';

/** Reading an image can take a minute or two; allow plenty of time. */
const PARSE_TIMEOUT_MS = 4 * 60 * 1000;

/** Uploads a crossword image for Claude to read into a draft for the editor. */
export function parseCrosswordImage(
  image: Blob,
  signal?: AbortSignal,
): Promise<ApiResult<ParseCrosswordResponse>> {
  const form = new FormData();
  form.set('image', image, 'crossword');
  return request(
    '/api/crosswords/parse',
    ParseCrosswordResponse,
    { method: 'POST', body: form, ...(signal && { signal }) },
    { timeoutMs: PARSE_TIMEOUT_MS },
  );
}
