import type { ExpoConfig } from 'expo/config';

// The demo configs point at the `demo-inkwell` project, which only exists in the Firebase Emulator Suite.
// Set GOOGLE_SERVICES_JSON / GOOGLE_SERVICES_PLIST to real (git-ignored) files to build against a real project.
const googleServicesJson =
  process.env.GOOGLE_SERVICES_JSON || './firebase/google-services.demo.json';
const googleServicesPlist =
  process.env.GOOGLE_SERVICES_PLIST || './firebase/GoogleService-Info.demo.plist';

// "Inkwell" is the working name — rename here (and in bundle IDs) once the final name is chosen.
const config: ExpoConfig = {
  name: 'Inkwell',
  slug: 'inkwell',
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'inkwell',
  userInterfaceStyle: 'automatic',
  ios: {
    bundleIdentifier: 'com.inkwell.app',
    googleServicesFile: googleServicesPlist,
    supportsTablet: false,
  },
  android: {
    package: 'com.inkwell.app',
    googleServicesFile: googleServicesJson,
    adaptiveIcon: {
      backgroundColor: '#12A594',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      {
        image: './assets/images/splash-icon.png',
        imageWidth: 120,
        backgroundColor: '#F7F6F3',
        dark: { backgroundColor: '#111413' },
      },
    ],
    '@react-native-firebase/app',
    '@react-native-firebase/auth',
    // React Native Firebase v27 resolves the Firebase Apple SDK via SPM, which requires dynamic frameworks.
    ['expo-build-properties', { ios: { useFrameworks: 'dynamic' } }],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
};

export default config;
