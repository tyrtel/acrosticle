/** A single uppercase A–Z letter. Branded so raw strings can't be passed by accident. */
export type Letter = string & { readonly __brand: 'Letter' };

const LETTER_PATTERN = /^[A-Z]$/;

export function isLetter(value: string): value is Letter {
  return LETTER_PATTERN.test(value);
}

/**
 * Normalizes user input to a Letter: trims it, uppercases it, and strips
 * diacritics (e.g. "é" -> "E"). Returns null if the input isn't exactly one letter.
 */
export function normalizeLetter(input: string): Letter | null {
  const candidate = input
    .trim()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toUpperCase();
  return isLetter(candidate) ? candidate : null;
}

/**
 * Labels for clues: A, B, ... Z, AA, BB, ... ZZ, AAA, ...
 * This doubled-letter style is the usual one for acrostics with more than 26 clues.
 */
export function clueLabel(index: number): string {
  if (!Number.isInteger(index) || index < 0) {
    throw new RangeError(`Clue index must be a non-negative integer, got ${index}`);
  }
  const letter = String.fromCharCode(65 + (index % 26));
  return letter.repeat(Math.floor(index / 26) + 1);
}
