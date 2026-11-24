import { Image } from 'expo-image';
import { StyleSheet } from 'react-native-unistyles';

export function Logo({ size = 72 }: { size?: number }) {
  return (
    <Image
      source={require('../../assets/images/logo.png')}
      style={styles.logo(size)}
      accessibilityLabel="Inkwell logo"
    />
  );
}

const styles = StyleSheet.create(() => ({
  logo: (size: number) => ({
    width: size,
    height: size,
  }),
}));
