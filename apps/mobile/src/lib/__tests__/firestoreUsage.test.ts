import { onSnapshot, updateDoc } from '@react-native-firebase/firestore';

import { listenDoc, updateDocument, type DocView } from '../db';
import { docSnapshotReads, resetFirestoreUsage, useFirestoreUsage } from '../firestoreUsage';

interface FakeSnapshot {
  exists: () => boolean;
  data: () => Record<string, unknown> | undefined;
  metadata: { fromCache: boolean; hasPendingWrites: boolean };
}

const snap = (
  data: Record<string, unknown> | undefined,
  meta: Partial<FakeSnapshot['metadata']> = {},
): FakeSnapshot => ({
  exists: () => data !== undefined,
  data: () => data,
  metadata: { fromCache: false, hasPendingWrites: false, ...meta },
});

/** Attaches listenDoc and returns a function that delivers snapshots to it. */
function attach(): (s: FakeSnapshot) => void {
  let deliver: ((s: FakeSnapshot) => void) | undefined;
  jest.mocked(onSnapshot).mockImplementation(((
    _ref: unknown,
    _options: unknown,
    next: (s: FakeSnapshot) => void,
  ) => {
    deliver = next;
    return jest.fn();
  }) as never);
  listenDoc('users/ada', (_doc: DocView) => undefined, jest.fn(), { includeMetadataChanges: true });
  return (s) => deliver?.(s);
}

const usage = () => useFirestoreUsage.getState();

beforeEach(() => {
  resetFirestoreUsage();
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
});

describe('docSnapshotReads', () => {
  it('bills a server snapshot once per version', () => {
    const first = docSnapshotReads(undefined, {
      fromCache: false,
      hasPendingWrites: false,
      key: 'a',
    });
    expect(first.reads).toBe(1);
    const repeat = docSnapshotReads(first.lastBilledKey, {
      fromCache: false,
      hasPendingWrites: false,
      key: 'a',
    });
    expect(repeat.reads).toBe(0);
  });

  it('bills a "does not exist" answer from the server', () => {
    expect(
      docSnapshotReads(undefined, { fromCache: false, hasPendingWrites: false, key: null }).reads,
    ).toBe(1);
  });

  it('never bills cache snapshots or our own pending writes', () => {
    expect(
      docSnapshotReads(undefined, { fromCache: true, hasPendingWrites: false, key: 'a' }).reads,
    ).toBe(0);
    expect(
      docSnapshotReads(undefined, { fromCache: false, hasPendingWrites: true, key: 'a' }).reads,
    ).toBe(0);
  });
});

describe('listenDoc', () => {
  it('counts the server versions a listener receives, not cache or metadata events', () => {
    const deliver = attach();
    deliver(snap(undefined, { fromCache: true })); // cache miss: free
    deliver(snap(undefined)); // server: doesn't exist → 1
    deliver(snap({ name: 'Ada' }, { hasPendingWrites: true })); // local write: free
    deliver(snap({ name: 'Ada' })); // server confirms new version → 1
    deliver(snap({ name: 'Ada' })); // metadata-only repeat: free
    deliver(snap({ name: 'Ada L' })); // changed on the server → 1
    expect(usage()).toEqual({ reads: 3, writes: 0 });
  });
});

describe('updateDocument', () => {
  it('counts one write per call', async () => {
    await updateDocument('users/ada', { firstName: 'Ada' });
    await updateDocument('users/ada', { lastName: 'L' });
    expect(updateDoc).toHaveBeenCalledTimes(2);
    expect(usage()).toEqual({ reads: 0, writes: 2 });
  });
});
