/**
 * A square's identity in the solve state, shared by every puzzle type: the
 * printed number for acrostics, the position (row × width + column + 1) for
 * crosswords. Always a positive integer, so the solve state, the protocol and
 * the room server don't need to know which kind of puzzle they hold.
 */
export type CellNumber = number;
