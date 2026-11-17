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
