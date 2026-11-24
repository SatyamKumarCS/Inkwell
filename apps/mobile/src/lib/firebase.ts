import { getApp } from '@react-native-firebase/app';
import { connectAuthEmulator, getAuth } from '@react-native-firebase/auth';
import {
  connectFirestoreEmulator,
  doc,
  getDocFromServer,
  getFirestore,
} from '@react-native-firebase/firestore';
import { Paths } from '@inkwell/shared';

import { getEmulatorHost, firebaseEmulatorsEnabled } from './env';

export const EMULATOR_PORTS = { auth: 9099, firestore: 8080 } as const;

let initialized = false;

/** Must run once at startup, before any Firebase read or write. */
export function initFirebase(): void {
  if (initialized) return;
  initialized = true;

  if (!firebaseEmulatorsEnabled) {
    if (__DEV__) {
      console.warn(
        `[firebase] Emulators disabled — this dev build is talking to the real "${getApp().options.projectId}" project.`,
      );
    }
    return;
  }

  const host = getEmulatorHost();
  connectAuthEmulator(getAuth(), `http://${host}:${EMULATOR_PORTS.auth}`);
  connectFirestoreEmulator(getFirestore(), host, EMULATOR_PORTS.firestore);
}

export type BackendStatus = 'reachable' | 'offline' | 'error';

/**
 * Dev diagnostic: asks the Firestore server (not the cache) for a doc. A permission error still proves the
 * server answered, because Phase 0 rules deny every request.
 */
export async function checkFirestore(): Promise<BackendStatus> {
  try {
    await getDocFromServer(doc(getFirestore(), Paths.aiModelsConfig));
    return 'reachable';
  } catch (error) {
    const code = (error as { code?: string }).code ?? '';
    if (code.endsWith('permission-denied')) return 'reachable';
    if (code.endsWith('unavailable')) return 'offline';
    return 'error';
  }
}
