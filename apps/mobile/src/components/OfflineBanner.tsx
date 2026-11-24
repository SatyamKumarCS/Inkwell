import { WifiOff } from 'lucide-react-native';
import { View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { useIsOffline } from '@/lib/network';

import { Text } from './Text';

/** Subtle "you're offline" strip. Renders nothing while online. */
export function OfflineBanner({ message = "You're offline" }: { message?: string }) {
  const offline = useIsOffline();
  const { theme } = useUnistyles();
  if (!offline) return null;

  return (
    <View style={styles.banner} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <WifiOff size={theme.iconSize.sm} color={theme.colors.textSecondary} />
      <Text variant="footnote" color="textSecondary">
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.surfaceMuted,
  },
}));
