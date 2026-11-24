import { getApp } from '@react-native-firebase/app';
import { connectAuthEmulator, getAuth } from '@react-native-firebase/auth';
import {
  connectFirestoreEmulator,
  doc,
  getDocFromServer,
  getFirestore,
} from '@react-native-firebase/firestore';
import {
  connectFunctionsEmulator,
  getFunctions,
  type Functions,
} from '@react-native-firebase/functions';
import { FUNCTIONS_REGION, Paths } from '@inkwell/shared';

import { assertFirebaseTarget, getEmulatorHost, firebaseEmulatorsEnabled } from './env';

export const EMULATOR_PORTS = { auth: 9099, firestore: 8080, functions: 5001 } as const;

let initialized = false;
let functionsInstance: Functions | undefined;

/** Cloud Functions in our region (the default instance would call us-central1). */
export function appFunctions(): Functions {
  functionsInstance ??= getFunctions(getApp(), FUNCTIONS_REGION);
  return functionsInstance;
}

/** Must run once at startup, before any Firebase read or write. */
export function initFirebase(): void {
  if (initialized) return;
  initialized = true;

  const projectId = getApp().options.projectId ?? '';
  assertFirebaseTarget(projectId, firebaseEmulatorsEnabled);

  if (!firebaseEmulatorsEnabled) {
    if (__DEV__) {
      console.warn(
        `[firebase] Emulators disabled — this dev build is talking to the real "${projectId}" project.`,
      );
    }
    return;
  }

  const host = getEmulatorHost();
  connectAuthEmulator(getAuth(), `http://${host}:${EMULATOR_PORTS.auth}`);
  connectFirestoreEmulator(getFirestore(), host, EMULATOR_PORTS.firestore);
  connectFunctionsEmulator(appFunctions(), host, EMULATOR_PORTS.functions);
}

export type BackendStatus = 'reachable' | 'offline' | 'error';

/**
 * Dev diagnostic: asks the Firestore server (not the cache) for a doc. A permission error still proves the
 * server answered, because the rules deny reading config/aiModels.
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
