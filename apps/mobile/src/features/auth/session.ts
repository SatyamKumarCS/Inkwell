import { getAuth, onAuthStateChanged } from '@react-native-firebase/auth';
import { doc, getFirestore, onSnapshot } from '@react-native-firebase/firestore';
import { useEffect } from 'react';
import { create } from 'zustand';
import { Paths, userSchema, type User } from '@inkwell/shared';

import { notificationPromptSupported } from '@/features/onboarding/notifications';

import { deriveGate, type AuthStatus, type Gate, type ProfileStatus } from './gate';
import type { NameHint } from './methods';

interface SessionState {
  authStatus: AuthStatus;
  uid: string | null;
  profileStatus: ProfileStatus;
  profile: User | null;
  /** Name shared by a sign-in provider, to prefill the name screen. */
  nameHint: NameHint | null;
  /** Bumped by "Try again" to resubscribe after a profile load error. */
  retryToken: number;
}

export const useSession = create<SessionState>(() => ({
  authStatus: 'initializing',
  uid: null,
  profileStatus: 'idle',
  profile: null,
  nameHint: null,
  retryToken: 0,
}));

export const retryProfileLoad = () =>
  useSession.setState((s) => ({ retryToken: s.retryToken + 1 }));

export const setNameHint = (nameHint: NameHint | null) => useSession.setState({ nameHint });

/** Maps a `users/{uid}` snapshot to the profile state. */
export function profileFromSnapshot(snapshot: {
  exists: boolean;
  fromCache: boolean;
  data: unknown;
}): Pick<SessionState, 'profileStatus' | 'profile'> {
  if (!snapshot.exists) {
    // A cache miss only means "not downloaded yet"; wait for the server before treating the user as new.
    return { profileStatus: snapshot.fromCache ? 'loading' : 'missing', profile: null };
  }
  const parsed = userSchema.safeParse(snapshot.data);
  if (!parsed.success) {
    console.warn('[session] users doc failed validation', parsed.error.issues);
    return { profileStatus: 'error', profile: null };
  }
  return { profileStatus: 'ready', profile: parsed.data };
}

/** Keeps the session store in sync with Firebase Auth and the signed-in user's profile doc. */
export function useSessionListener(): void {
  const retryToken = useSession((s) => s.retryToken);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(getAuth(), (user) => {
      unsubscribeProfile?.();
      unsubscribeProfile = undefined;

      if (!user) {
        useSession.setState({
          authStatus: 'signedOut',
          uid: null,
          profileStatus: 'idle',
          profile: null,
          nameHint: null,
        });
        return;
      }

      useSession.setState({ authStatus: 'signedIn', uid: user.uid, profileStatus: 'loading' });
      unsubscribeProfile = onSnapshot(
        doc(getFirestore(), Paths.user(user.uid)),
        { includeMetadataChanges: true },
        (snapshot) => {
          useSession.setState(
            profileFromSnapshot({
              exists: snapshot.exists(),
              fromCache: snapshot.metadata.fromCache,
              // Pending serverTimestamp() writes would otherwise read as null while offline.
              data: snapshot.data({ serverTimestamps: 'estimate' }),
            }),
          );
        },
        (error) => {
          console.warn('[session] profile listener failed', error);
          useSession.setState({ profileStatus: 'error' });
        },
      );
    });

    return () => {
      unsubscribeAuth();
      unsubscribeProfile?.();
    };
  }, [retryToken]);
}

export function useGate(): Gate {
  return useSession((s) =>
    deriveGate(s, { notificationPromptSupported: notificationPromptSupported() }),
  );
}
