/**
 * What a solver can put in a square: one or more letters (from any alphabet),
 * digits, punctuation marks or symbols, with single spaces allowed between
 * them ("TH", "E or I"). At most MAX_ENTRY_LENGTH characters. No leading or
 * trailing spaces, no control characters. Case is kept as typed. Branded so
 * raw strings can't be passed by accident. See ADR 0005.
 */
export type Entry = string & { readonly __brand: 'Entry' };

/**
 * The most characters (code points, spaces included) a square can hold. A
 * safety bound for the room and other solvers, far beyond real use.
 */
export const MAX_ENTRY_LENGTH = 100;

/** Runs of allowed characters, separated by single spaces. */
const ENTRY_PATTERN = /^[\p{L}\p{N}\p{P}\p{S}]+(?: [\p{L}\p{N}\p{P}\p{S}]+)*$/u;

export function isEntry(value: string): value is Entry {
  // A character is at most two UTF-16 units: reject huge input before any other work.
  if (value.length > MAX_ENTRY_LENGTH * 2 || [...value].length > MAX_ENTRY_LENGTH) return false;
  return ENTRY_PATTERN.test(value) && value.normalize('NFC') === value;
}

/**
 * Normalizes user input to an Entry: trims it, turns runs of inner whitespace
 * into single spaces, and composes accents into one character (e + ◌́ becomes
 * é). Returns null unless the result is a valid entry. Case is not changed.
 */
export function normalizeEntry(input: string): Entry | null {
  const candidate = input.trim().replace(/\s+/g, ' ').normalize('NFC');
  return isEntry(candidate) ? candidate : null;
}

/** The first character of an entry (e.g. for the acrostic): "THE" gives "T". */
export function firstCharacter(entry: Entry): Entry {
  // Safe: an entry is never empty and never starts with a space, so its first
  // code point is itself a valid entry.
  return String.fromCodePoint(entry.codePointAt(0) ?? 0) as Entry;
}
