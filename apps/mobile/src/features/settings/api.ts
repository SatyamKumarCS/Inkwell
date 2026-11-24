import { useEffect } from 'react';
import { UnistylesRuntime } from 'react-native-unistyles';
import { Paths, type ThemePreference, type User } from '@inkwell/shared';

import { serverTimestamp, updateDocument } from '@/lib/db';

/** Applies the in-app appearance preference ("system" follows the device). */
export function applyThemePreference(preference: ThemePreference): void {
  if (preference === 'system') {
    UnistylesRuntime.setAdaptiveThemes(true);
    return;
  }
  // setTheme throws while adaptive themes are on.
  UnistylesRuntime.setAdaptiveThemes(false);
  UnistylesRuntime.setTheme(preference);
}

/** Keeps the app's theme in step with the profile's setting. */
export function useThemePreference(preference: ThemePreference | undefined): void {
  useEffect(() => {
    applyThemePreference(preference ?? 'system');
  }, [preference]);
}

/** Saves the user's settings (one write; rules allow only theme/startOfWeek/AI keys). */
export function saveSettings(uid: string, settings: User['settings']): Promise<void> {
  return updateDocument(Paths.user(uid), { settings, updatedAt: serverTimestamp() });
}
