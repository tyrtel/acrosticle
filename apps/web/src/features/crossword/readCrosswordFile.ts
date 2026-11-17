import {
  crosswordFromIpuz,
  crosswordFromPuz,
  type Crossword,
  type CrosswordResult,
} from '@gridicles/crossword';
import { parseCrosswordFile } from '@gridicles/protocol';

/** The file types crosswords can be imported from. */
export const CROSSWORD_FILE_TYPES = '.puz,.ipuz,.json,application/json';

/**
 * Reads a crossword from a file's bytes: an Across Lite .puz, an .ipuz, or our
 * own JSON format (which says `"kind": "crossword"`).
 */
export function readCrosswordFile(name: string, bytes: Uint8Array): CrosswordResult {
  if (name.toLowerCase().endsWith('.puz')) return crosswordFromPuz(bytes);
  return readCrosswordText(new TextDecoder().decode(bytes));
}

/** Reads pasted text: .ipuz or our JSON format. */
export function readCrosswordText(text: string): CrosswordResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: "That isn't a .puz file or valid JSON." };
  }
  if (typeof data === 'object' && data !== null && 'kind' in data && data.kind === 'crossword') {
    const result = parseCrosswordFile(data);
    return result.ok ? { ok: true, crossword: result.value } : result;
  }
  return crosswordFromIpuz(data);
}

export type { Crossword };
