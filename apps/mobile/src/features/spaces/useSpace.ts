import { doc, getFirestore, onSnapshot } from '@react-native-firebase/firestore';
import { useEffect, useState } from 'react';
import { Paths, spaceSchema, type Space } from '@inkwell/shared';

export type SpaceState =
  | { status: 'loading'; space: null }
  | { status: 'ready'; space: Space }
  | { status: 'error'; space: null };

const LOADING: SpaceState = { status: 'loading', space: null };

/** Live `spaces/{spaceId}`; served from the offline cache when there is no connection. */
export function useSpace(spaceId: string): SpaceState {
  // Tagged with the id it belongs to, so switching spaces shows "loading" instead of the old space.
  const [result, setResult] = useState<{ spaceId: string; state: SpaceState } | null>(null);

  useEffect(
    () =>
      onSnapshot(
        doc(getFirestore(), Paths.space(spaceId)),
        (snapshot) => {
          // A cache miss while offline stays "loading" until the server answers.
          if (!snapshot.exists() && snapshot.metadata.fromCache) return;
          const parsed = spaceSchema.safeParse(snapshot.data({ serverTimestamps: 'estimate' }));
          setResult({
            spaceId,
            state: parsed.success
              ? { status: 'ready', space: parsed.data }
              : { status: 'error', space: null },
          });
        },
        () => setResult({ spaceId, state: { status: 'error', space: null } }),
      ),
    [spaceId],
  );

  return result?.spaceId === spaceId ? result.state : LOADING;
}
