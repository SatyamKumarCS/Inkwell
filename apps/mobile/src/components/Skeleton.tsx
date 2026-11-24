import { useEffect } from 'react';
import type { DimensionValue } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { StyleSheet } from 'react-native-unistyles';

export interface SkeletonProps {
  width?: DimensionValue;
  height?: number;
  radius?: number;
}

/** Pulsing placeholder shown while content loads. */
export function Skeleton({ width = '100%', height = 16, radius }: SkeletonProps) {
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = withRepeat(withTiming(0.4, { duration: 800 }), -1, true);
  }, [opacity]);

  const animated = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.block(width, height, radius), animated]}
    />
  );
}

const styles = StyleSheet.create((theme) => ({
  block: (width: DimensionValue, height: number, radius?: number) => ({
    width,
    height,
    borderRadius: radius ?? theme.radii.sm,
    backgroundColor: theme.colors.skeleton,
  }),
}));
