import { Text as RNText, type TextProps as RNTextProps } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import type { ColorName, TypographyVariant } from '@/theme';

export interface TextProps extends RNTextProps {
  variant?: TypographyVariant;
  color?: ColorName;
  align?: 'left' | 'center' | 'right';
}

/** Themed text. Scales with the system font size (dynamic type). */
export function Text({ variant = 'body', color = 'text', align, style, ...rest }: TextProps) {
  return <RNText style={[styles.text(variant, color, align), style]} {...rest} />;
}

const styles = StyleSheet.create((theme) => ({
  text: (variant: TypographyVariant, color: ColorName, align?: TextProps['align']) => ({
    ...theme.typography[variant],
    color: theme.colors[color],
    textAlign: align,
  }),
}));
