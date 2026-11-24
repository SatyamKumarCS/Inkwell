import { PermissionsAndroid, Platform } from 'react-native';

/**
 * Whether onboarding shows the notification pre-permission screen.
 * - Android 13+ (API 33): yes, POST_NOTIFICATIONS is a runtime permission.
 * - Android 12 and older: no, notifications are allowed without asking.
 * - iOS: not until Phase 3, which adds push (APNs needs an Apple Developer account). Flip this then; the
 *   screen and the rest of the flow already handle it.
 */
export function notificationPromptSupported(
  os: string = Platform.OS,
  version: string | number = Platform.Version,
): boolean {
  return os === 'android' && typeof version === 'number' && version >= 33;
}

export type NotificationPermissionResult = 'granted' | 'denied' | 'blocked';

export async function hasNotificationPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  return PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
}

/** Shows the system prompt. `blocked` means Android won't ask again; only Settings can change it. */
export async function requestNotificationPermission(): Promise<NotificationPermissionResult> {
  // iOS gets its own implementation (expo-notifications) in Phase 3.
  if (Platform.OS !== 'android') return 'denied';
  const result = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
  );
  if (result === PermissionsAndroid.RESULTS.GRANTED) return 'granted';
  if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) return 'blocked';
  return 'denied';
}
