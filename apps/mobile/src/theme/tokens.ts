/**
 * Inkwell design tokens. Components must read colors, spacing, radii and type from the theme —
 * never hard-code them.
 */

const palette = {
  teal300: '#5ED6C4',
  teal400: '#2EC4B0',
  teal500: '#12A594',
  teal700: '#0B7A6E',
  teal800: '#086358',
  teal950: '#06201C',
  paper: '#F7F6F3',
  white: '#FFFFFF',
  ink: '#1C1B19',
  night: '#111413',
} as const;

const lightColorValues = {
  background: palette.paper,
  surface: palette.white,
  surfaceMuted: '#EFEDE8',
  border: '#E3E0DA',
  text: palette.ink,
  textSecondary: '#6B6862',
  textTertiary: '#9A968F',
  accent: palette.teal700,
  accentPressed: palette.teal800,
  accentSoft: '#DDF3EF',
  onAccent: palette.white,
  danger: '#C93B3B',
  dangerSoft: '#FBE7E7',
  success: '#2E9E5B',
  warning: '#B97D0C',
  overlay: 'rgba(0, 0, 0, 0.4)',
  skeleton: '#E6E3DD',
} as const;

export type ColorName = keyof typeof lightColorValues;
export type ThemeColors = Record<ColorName, string>;

export const lightColors: ThemeColors = lightColorValues;

export const darkColors: ThemeColors = {
  background: palette.night,
  surface: '#1B1F1E',
  surfaceMuted: '#252A28',
  border: '#2E3432',
  text: '#F2F1EE',
  textSecondary: '#A8A49D',
  textTertiary: '#77736D',
  accent: palette.teal400,
  accentPressed: palette.teal300,
  accentSoft: '#123A35',
  onAccent: palette.teal950,
  danger: '#F06A6A',
  dangerSoft: '#3A1D1D',
  success: '#4CC47F',
  warning: '#E3A93B',
  overlay: 'rgba(0, 0, 0, 0.6)',
  skeleton: '#262B29',
};

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;

/** Minimum touch target (accessibility). */
export const hitTarget = 44;

/** System font (SF Pro / Roboto); sizes follow the iOS type ramp and scale with dynamic type. */
export const typography = {
  largeTitle: { fontSize: 34, lineHeight: 41, fontWeight: '700' },
  title1: { fontSize: 28, lineHeight: 34, fontWeight: '700' },
  title2: { fontSize: 22, lineHeight: 28, fontWeight: '600' },
  title3: { fontSize: 20, lineHeight: 25, fontWeight: '600' },
  headline: { fontSize: 17, lineHeight: 22, fontWeight: '600' },
  body: { fontSize: 17, lineHeight: 22, fontWeight: '400' },
  callout: { fontSize: 16, lineHeight: 21, fontWeight: '400' },
  subhead: { fontSize: 15, lineHeight: 20, fontWeight: '400' },
  footnote: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '400' },
} as const;

export type TypographyVariant = keyof typeof typography;

export const iconSize = {
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
} as const;

interface Shadows {
  card: string;
  raised: string;
}

const lightShadows: Shadows = {
  card: '0px 1px 2px rgba(0, 0, 0, 0.05), 0px 4px 12px rgba(0, 0, 0, 0.05)',
  raised: '0px 8px 24px rgba(0, 0, 0, 0.12)',
};

const darkShadows: Shadows = {
  card: '0px 0px 0px rgba(0, 0, 0, 0)',
  raised: '0px 8px 24px rgba(0, 0, 0, 0.5)',
};

const shared = { spacing, radii, typography, iconSize, hitTarget } as const;

export type AppTheme = typeof shared & {
  colors: ThemeColors;
  shadows: Shadows;
  isDark: boolean;
};

export const lightTheme: AppTheme = {
  ...shared,
  colors: lightColors,
  shadows: lightShadows,
  isDark: false,
};
export const darkTheme: AppTheme = {
  ...shared,
  colors: darkColors,
  shadows: darkShadows,
  isDark: true,
};
