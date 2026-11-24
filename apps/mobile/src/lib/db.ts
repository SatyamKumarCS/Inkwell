import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDocs,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type QueryConstraint,
} from '@react-native-firebase/firestore';

import { docSnapshotReads, recordReads, recordWrites } from './firestoreUsage';

/**
 * The only module that talks to Firestore (enforced by lint), so every read and write is counted against
 * the Spark quota in dev builds. Query listeners and batched writes are added here as features need them.
 */

export { deleteField, limit, orderBy, serverTimestamp, where, type QueryConstraint };

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

/** Creates or overwrites a document (one write). Resolves when the server confirms it. */
export function setDocument(path: string, data: Record<string, unknown>): Promise<void> {
  recordWrites(1, `set ${path}`);
  return setDoc(doc(getFirestore(), path), data);
}

/** Deletes a document (one write). */
export function deleteDocument(path: string): Promise<void> {
  recordWrites(1, `delete ${path}`);
  return deleteDoc(doc(getFirestore(), path));
}

/** A new auto-generated id in a collection, without writing anything. */
export function newDocId(collectionPath: string): string {
  return doc(collection(getFirestore(), collectionPath)).id;
}

export type BatchOp =
  | { kind: 'set'; path: string; data: Record<string, unknown> }
  | { kind: 'update'; path: string; data: Record<string, unknown> }
  | { kind: 'delete'; path: string };

/** Applies several writes atomically, as one commit (each document still counts as one write). */
export function commitBatch(ops: BatchOp[], label: string): Promise<void> {
  if (ops.length === 0) return Promise.resolve();
  const db = getFirestore();
  const batch = writeBatch(db);
  for (const op of ops) {
    const ref = doc(db, op.path);
    if (op.kind === 'set') batch.set(ref, op.data);
    else if (op.kind === 'update') batch.update(ref, op.data);
    else batch.delete(ref);
  }
  recordWrites(ops.length, `batch ${label}`);
  return batch.commit();
}

/** Reads a query once (server if reachable, else cache). One read per document, at least one. */
export async function fetchQuery(
  collectionPath: string,
  constraints: QueryConstraint[],
): Promise<QueryDocView[]> {
  const snapshot = await getDocs(query(collection(getFirestore(), collectionPath), ...constraints));
  if (!snapshot.metadata.fromCache) {
    recordReads(Math.max(1, snapshot.size), `get ${collectionPath}`);
  }
  return snapshot.docs.map((d) => ({
    id: d.id,
    data: d.data({ serverTimestamps: 'estimate' }) as Record<string, unknown>,
  }));
}

/** One document of a query result. */
export interface QueryDocView {
  id: string;
  data: Record<string, unknown>;
}

export interface QueryView {
  docs: QueryDocView[];
  fromCache: boolean;
}

/**
 * Listens to a query. Billing (dev counter): a server snapshot costs one read per added or changed document,
 * and at least one read; cache snapshots are free. Keep queries narrow (always filter by owner or space).
 */
export function listenQuery(
  collectionPath: string,
  constraints: QueryConstraint[],
  onNext: (view: QueryView) => void,
  onError: (error: unknown) => void,
): () => void {
  let first = true;
  return onSnapshot(
    query(collection(getFirestore(), collectionPath), ...constraints),
    (snapshot) => {
      const fromCache = snapshot.metadata.fromCache;
      if (__DEV__ && !fromCache) {
        const changed = snapshot
          .docChanges()
          .filter((c) => c.type !== 'removed' && !c.doc.metadata.hasPendingWrites).length;
        recordReads(first ? Math.max(1, changed) : changed, `query ${collectionPath}`);
        first = false;
      }
      onNext({
        fromCache,
        docs: snapshot.docs.map((d) => ({
          id: d.id,
          data: d.data({ serverTimestamps: 'estimate' }) as Record<string, unknown>,
        })),
      });
    },
    onError,
  );
}
