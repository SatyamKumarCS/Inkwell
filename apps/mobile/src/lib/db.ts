import {
  doc,
  getFirestore,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from '@react-native-firebase/firestore';

import { docSnapshotReads, recordReads, recordWrites } from './firestoreUsage';

/**
 * The only module that talks to Firestore (enforced by lint), so every read and write is counted against
 * the Spark quota in dev builds. Query listeners and batched writes are added here as features need them.
 */

export { serverTimestamp };

/** A document snapshot reduced to what callers use. */
export interface DocView {
  exists: boolean;
  fromCache: boolean;
  hasPendingWrites: boolean;
  /** Pending serverTimestamp() values are estimated instead of null, so offline writes still parse. */
  data: Record<string, unknown> | undefined;
}

export interface ListenOptions {
  /** Also report metadata-only changes (e.g. cache → server confirmation). */
  includeMetadataChanges?: boolean;
}

/** Listens to one document. Returns the unsubscribe function. */
export function listenDoc(
  path: string,
  onNext: (doc: DocView) => void,
  onError: (error: unknown) => void,
  { includeMetadataChanges = false }: ListenOptions = {},
): () => void {
  let lastBilledKey: string | null | undefined;
  return onSnapshot(
    doc(getFirestore(), path),
    { includeMetadataChanges },
    (snapshot) => {
      const exists = snapshot.exists();
      const data = exists ? snapshot.data({ serverTimestamps: 'estimate' }) : undefined;
      const view: DocView = {
        exists,
        fromCache: snapshot.metadata.fromCache,
        hasPendingWrites: snapshot.metadata.hasPendingWrites,
        data,
      };
      if (__DEV__) {
        const billing = docSnapshotReads(lastBilledKey, {
          fromCache: view.fromCache,
          hasPendingWrites: view.hasPendingWrites,
          key: exists ? JSON.stringify(data) : null,
        });
        lastBilledKey = billing.lastBilledKey;
        recordReads(billing.reads, `listen ${path}`);
      }
      onNext(view);
    },
    onError,
  );
}

/** Updates fields of an existing document (one write). Resolves when the server confirms it. */
export function updateDocument(path: string, data: Record<string, unknown>): Promise<void> {
  recordWrites(1, `update ${path}`);
  return updateDoc(doc(getFirestore(), path), data);
}
