import type { CellNumber } from '@acrosticle/core';

/** Another solver, as shown on the squares their cursor is on. */
export interface Peer {
  readonly id: string;
  readonly name: string;
  readonly color: string;
}

/** Other solvers' cursors: cell -> who is there. */
export type PeerMap = ReadonlyMap<CellNumber, readonly Peer[]>;

/** "Ada Lovelace" -> "AL", "bo" -> "B", "  " -> "?". */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = words[0]?.[0];
  if (!first) return '?';
  const last = words.length > 1 ? words[words.length - 1]?.[0] : undefined;
  return (first + (last ?? '')).toUpperCase();
}

/** Black or white, whichever reads better on the given #rrggbb background. */
export function readableTextColor(background: string): '#000000' | '#ffffff' {
  const hex = /^#([0-9a-f]{6})$/i.exec(background)?.[1];
  if (!hex) return '#ffffff';
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  // Contrast against white vs. black (WCAG formula); pick the higher.
  return 1.05 / (luminance + 0.05) >= (luminance + 0.05) / 0.05 ? '#ffffff' : '#000000';
}

/** "Bo is here", "Bo and Cy are here", "Bo, Cy and Di are here". */
export function describePeers(peers: readonly Peer[]): string {
  const names = peers.map((p) => p.name);
  if (names.length === 0) return '';
  if (names.length === 1) return `${names[0]} is here`;
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]} are here`;
}
