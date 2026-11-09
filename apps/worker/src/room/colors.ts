/** Cursor colors for room members: distinct, and readable as outlines in light and dark themes. */
export const MEMBER_COLORS = [
  '#e4572e',
  '#1b998b',
  '#7b2cbf',
  '#f4a259',
  '#2e86de',
  '#d81159',
  '#5a9e3a',
  '#8f6b4f',
] as const;

/** Picks the least-used color among those already taken (first one wins ties). */
export function pickColor(taken: readonly string[]): string {
  const counts = new Map<string, number>(MEMBER_COLORS.map((c) => [c, 0]));
  for (const color of taken) {
    const count = counts.get(color);
    if (count !== undefined) counts.set(color, count + 1);
  }
  let best: string = MEMBER_COLORS[0];
  for (const color of MEMBER_COLORS) {
    if ((counts.get(color) ?? 0) < (counts.get(best) ?? 0)) best = color;
  }
  return best;
}
