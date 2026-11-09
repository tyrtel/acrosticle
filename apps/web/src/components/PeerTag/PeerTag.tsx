import styles from './PeerTag.module.css';
import { initials, readableTextColor, type Peer } from './peers';

/**
 * Colored initials for the solvers on a square. Decorative: the host element
 * carries the accessible description, and decides when the tag is visible.
 */
export function PeerTag({ peers, className }: { peers: readonly Peer[]; className?: string }) {
  return (
    <span className={className ? `${styles.tag} ${className}` : styles.tag} aria-hidden="true">
      {peers.map((peer) => (
        <span
          key={peer.id}
          className={styles.chip}
          style={{ background: peer.color, color: readableTextColor(peer.color) }}
        >
          {initials(peer.name)}
        </span>
      ))}
    </span>
  );
}
