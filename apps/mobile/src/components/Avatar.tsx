import { Image } from 'expo-image';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { Text } from './Text';

export interface AvatarProps {
  name: string;
  uri?: string | null;
  size?: number;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase() || '?';
}

export function Avatar({ name, uri, size = 40 }: AvatarProps) {
  return (
    <View accessibilityLabel={name} style={styles.circle(size)}>
      {uri ? (
        <Image source={{ uri }} style={styles.image(size)} contentFit="cover" />
      ) : (
        <Text variant={size >= 48 ? 'title3' : 'subhead'} color="accent">
          {initials(name)}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  circle: (size: number) => ({
    width: size,
    height: size,
    borderRadius: size / 2,
    backgroundColor: theme.colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  }),
  image: (size: number) => ({
    width: size,
    height: size,
  }),
}));
