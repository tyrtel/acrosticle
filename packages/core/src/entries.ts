/**
 * What a solver can put in a square: exactly one letter (from any alphabet),
 * digit, punctuation mark or symbol. No spaces or control characters. Case is
 * kept as typed. Branded so raw strings can't be passed by accident.
 */
export type Entry = string & { readonly __brand: 'Entry' };

/** One code point that is a letter, number, punctuation mark or symbol. */
const ENTRY_PATTERN = /^[\p{L}\p{N}\p{P}\p{S}]$/u;

export function isEntry(value: string): value is Entry {
  return ENTRY_PATTERN.test(value);
}

/**
 * Normalizes user input to an Entry: trims it and composes accents into one
 * character (e + ◌́ becomes é). Returns null unless the result is exactly one
 * allowed character. Case is not changed.
 */
export function normalizeEntry(input: string): Entry | null {
  const candidate = input.trim().normalize('NFC');
  return isEntry(candidate) ? candidate : null;
}
