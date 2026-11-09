import type { CellNumber } from '@acrosticle/core';

export type CellListResult = { ok: true; cells: CellNumber[] } | { ok: false; error: string };

/** Parses a typed list of blank numbers, e.g. "138 5 44" or "138, 5, 44". */
export function parseCellList(text: string): CellListResult {
  const tokens = text.split(/[\s,]+/).filter(Boolean);
  const bad = tokens.find((token) => !/^\d+$/.test(token));
  if (bad !== undefined) return { ok: false, error: `"${bad}" is not a square number` };
  return { ok: true, cells: tokens.map(Number) };
}
