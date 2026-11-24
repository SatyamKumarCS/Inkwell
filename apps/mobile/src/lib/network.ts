import { useNetworkState } from 'expo-network';

/**
 * True only when the device reports no network connection. `isInternetReachable` is deliberately ignored:
 * a phone on Wi-Fi without internet can still reach the local Firebase emulators.
 */
export function useIsOffline(): boolean {
  return useNetworkState().isConnected === false;
}
