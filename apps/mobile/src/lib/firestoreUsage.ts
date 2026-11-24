import { create } from 'zustand';

/**
 * Dev-only estimate of the Firestore operations this app session is billed for. The project runs on the
 * Spark plan, whose daily quota (50k reads / 20k writes) is shared by every user, so each feature's cost has
 * to be visible while testing. See SPEC.md §1.1.
 *
 * Billing rules mirrored here: snapshots served from the offline cache are free; a listener is charged one
 * read each time the server delivers a new version of a document (including "doesn't exist"); every
 * document written is one write. Approximate: re-reads after a listener was disconnected for 30+ minutes,
 * and writes the server rejects, are not tracked.
 */
interface FirestoreUsage {
  reads: number;
  writes: number;
}

export const useFirestoreUsage = create<FirestoreUsage>(() => ({ reads: 0, writes: 0 }));

function record(kind: keyof FirestoreUsage, count: number, label: string) {
  if (!__DEV__ || count <= 0) return;
  useFirestoreUsage.setState((s) => ({ [kind]: s[kind] + count }));
  const { reads, writes } = useFirestoreUsage.getState();
  console.log(
    `[firestore] +${count} ${kind} (${label}) · session: ${reads} reads, ${writes} writes`,
  );
}

export const recordReads = (count: number, label: string) => record('reads', count, label);
export const recordWrites = (count: number, label: string) => record('writes', count, label);

export function resetFirestoreUsage() {
  useFirestoreUsage.setState({ reads: 0, writes: 0 });
}

/** A snapshot as far as billing is concerned. */
export interface SnapshotBillingInfo {
  fromCache: boolean;
  hasPendingWrites: boolean;
  /** Stable serialisation of the document's data, or null if it doesn't exist. */
  key: string | null;
}

/**
 * Whether a document snapshot is a billed read: it came from the server, isn't just our own pending write,
 * and carries a version we haven't been charged for yet (metadata-only events repeat the same data).
 */
export function docSnapshotReads(
  lastBilledKey: string | null | undefined,
  snapshot: SnapshotBillingInfo,
): { reads: 0 | 1; lastBilledKey: string | null | undefined } {
  if (snapshot.fromCache || snapshot.hasPendingWrites) return { reads: 0, lastBilledKey };
  if (lastBilledKey !== undefined && lastBilledKey === snapshot.key) {
    return { reads: 0, lastBilledKey };
  }
  return { reads: 1, lastBilledKey: snapshot.key };
}
