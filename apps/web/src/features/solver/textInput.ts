import { normalizeEntry, type Entry } from '@acrosticle/core';

const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

/**
 * Splits text from an input event (a typed character, an IME result, a
 * swipe-typed word or a paste) into entries, one per square, skipping
 * anything that can't go in a square (spaces, control characters).
 */
export function entriesFromText(text: string): Entry[] {
  const entries: Entry[] = [];
  for (const { segment } of segmenter.segment(text.normalize('NFC'))) {
    const entry = normalizeEntry(segment);
    if (entry) entries.push(entry);
  }
  return entries;
}
