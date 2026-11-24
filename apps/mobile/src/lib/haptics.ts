import * as Haptics from 'expo-haptics';

/** Haptic feedback for toggles and completions. Failures (e.g. unsupported hardware) are ignored. */
export const haptics = {
  selection: () => Haptics.selectionAsync().catch(() => undefined),
  success: () =>
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined),
  impact: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined),
  error: () =>
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined),
};
