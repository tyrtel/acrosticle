import type { CellNumber } from './cells';

/**
 * Squares someone has highlighted (shown green for everyone in the room).
 * A solving aid only: highlights never affect letters or the acrostic.
 */
export type Marks = ReadonlySet<CellNumber>;

export const noMarks: Marks = new Set();

/** A change to one square's highlight. */
export interface MarkEdit {
  readonly cell: CellNumber;
  readonly marked: boolean;
}

/** Returns new marks with `cell` highlighted or not. Same reference if nothing changes. */
export function setMark(marks: Marks, cell: CellNumber, marked: boolean): Marks {
  if (marks.has(cell) === marked) return marks;
  const next = new Set(marks);
  if (marked) next.add(cell);
  else next.delete(cell);
  return next;
}
