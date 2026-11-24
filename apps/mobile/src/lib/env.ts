import Constants from 'expo-constants';

/** Local development always talks to the Firebase Emulator Suite unless explicitly disabled. */
export const firebaseEmulatorsEnabled =
  __DEV__ && process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATORS !== 'false';

/**
 * Host running the emulators. Defaults to the Metro host so physical phones on the same network work;
 * React Native Firebase maps "localhost" to 10.0.2.2 on Android emulators.
 */
export function getEmulatorHost(): string {
  const explicit = process.env.EXPO_PUBLIC_EMULATOR_HOST;
  if (explicit) return explicit;
  const metroHost = Constants.expoConfig?.hostUri?.split(':')[0];
  return metroHost || 'localhost';
}

/**
 * Emulators must only ever be paired with a `demo-*` project, and a real project only with real services:
 * a dev build on a real config would mix local test data with production users, and a release build on
 * the demo config would be unable to sign anyone in.
 */
export function assertFirebaseTarget(projectId: string, useEmulators: boolean): void {
  const isDemoProject = projectId.startsWith('demo-');
  if (useEmulators && !isDemoProject) {
    throw new Error(
      `[firebase] Emulators are enabled but the app config points at the real "${projectId}" project. ` +
        'Dev builds must use the demo config: unset GOOGLE_SERVICES_JSON / GOOGLE_SERVICES_PLIST.',
    );
  }
  if (!useEmulators && isDemoProject) {
    throw new Error(
      `[firebase] This build uses the demo "${projectId}" config without the emulators. ` +
        'Set GOOGLE_SERVICES_JSON to the real google-services.json (EAS file variable).',
    );
  }
}
