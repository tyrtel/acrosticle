import { ParsePuzzleResponse } from '@acrosticle/protocol';
import { request, type ApiResult } from '../../lib/api';

/** Reading an image can take a minute or two; allow plenty of time. */
export const PARSE_TIMEOUT_MS = 4 * 60 * 1000;

/** Uploads an image for Claude to read into a draft puzzle. */
export function parseImage(
  image: Blob,
  signal?: AbortSignal,
): Promise<ApiResult<ParsePuzzleResponse>> {
  const form = new FormData();
  form.set('image', image, 'puzzle');
  return request(
    '/api/puzzles/parse',
    ParsePuzzleResponse,
    { method: 'POST', body: form, ...(signal && { signal }) },
    { timeoutMs: PARSE_TIMEOUT_MS },
  );
}
