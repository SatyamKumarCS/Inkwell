import { StyleSheet } from 'react-native-unistyles';

import { darkTheme, lightTheme, type AppTheme } from './tokens';

const appThemes: { light: AppTheme; dark: AppTheme } = {
  light: lightTheme,
  dark: darkTheme,
};

const breakpoints = {
  xs: 0,
  md: 600,
  lg: 1024,
} as const;

type AppThemes = typeof appThemes;
type AppBreakpoints = typeof breakpoints;

declare module 'react-native-unistyles' {
  export interface UnistylesThemes extends AppThemes {}
  export interface UnistylesBreakpoints extends AppBreakpoints {}
}

// Follows the system appearance. The in-app light/dark/system preference arrives with Settings (Phase 6).
StyleSheet.configure({
  themes: appThemes,
  breakpoints,
  settings: { adaptiveThemes: true },
});
