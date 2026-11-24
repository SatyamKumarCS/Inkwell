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
