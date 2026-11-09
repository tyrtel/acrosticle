import type { Letter } from './letters';
import type { CellNumber } from './puzzle';

/** The letters entered so far, keyed by cell number. Missing key = empty cell. */
export type SolveState = Readonly<Record<CellNumber, Letter>>;

export const emptySolveState: SolveState = Object.freeze({});

/**
 * Returns a new state with `cell` set to `value`, or cleared if `value` is null.
 * Never mutates its input.
 */
export function setCell(state: SolveState, cell: CellNumber, value: Letter | null): SolveState {
  assertCellNumber(cell);
  if (value === null) {
    if (!(cell in state)) return state;
    const { [cell]: _removed, ...rest } = state;
    return rest;
  }
  if (state[cell] === value) return state;
  return { ...state, [cell]: value };
}

export function getCell(state: SolveState, cell: CellNumber): Letter | null {
  return state[cell] ?? null;
}

export function filledCount(state: SolveState): number {
  return Object.keys(state).length;
}

function assertCellNumber(cell: number): void {
  if (!Number.isInteger(cell) || cell < 1) {
    throw new RangeError(`Cell number must be a positive integer, got ${cell}`);
  }
}
