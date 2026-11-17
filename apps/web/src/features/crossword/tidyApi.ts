import { TidyCluesResponse } from '@gridicles/protocol';
import { jsonBody, request, type ApiResult } from '../../lib/api';

/** Asks the server (and Claude) to sort messy clue text into Across and Down clues. */
export function tidyClueText(text: string): Promise<ApiResult<TidyCluesResponse>> {
  return request('/api/crosswords/clues', TidyCluesResponse, jsonBody({ text }));
}
