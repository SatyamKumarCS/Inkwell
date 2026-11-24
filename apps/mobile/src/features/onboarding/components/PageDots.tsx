import { View } from 'react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { StyleSheet } from 'react-native-unistyles';

const DOT = 8;
const ACTIVE_DOT = 22;

function Dot({ active }: { active: boolean }) {
  const animated = useAnimatedStyle(() => ({ width: withSpring(active ? ACTIVE_DOT : DOT) }));
  return <Animated.View style={[styles.dot, active && styles.active, animated]} />;
}

export function PageDots({ count, index }: { count: number; index: number }) {
  return (
    <View
      style={styles.row}
      accessible
      accessibilityRole="text"
      accessibilityLabel={`Page ${index + 1} of ${count}`}
    >
      {Array.from({ length: count }, (_, i) => (
        <Dot key={i} active={i === index} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: theme.spacing.xs,
  },
  dot: {
    height: DOT,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.border,
  },
  active: {
    backgroundColor: theme.colors.accent,
  },
}));
