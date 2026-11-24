import type { ExpoConfig } from 'expo/config';

// The demo configs point at the `demo-inkwell` project, which only exists in the Firebase Emulator Suite.
// Set GOOGLE_SERVICES_JSON / GOOGLE_SERVICES_PLIST to real (git-ignored) files to build against a real project.
const googleServicesJson =
  process.env.GOOGLE_SERVICES_JSON || './firebase/google-services.demo.json';
const googleServicesPlist =
  process.env.GOOGLE_SERVICES_PLIST || './firebase/GoogleService-Info.demo.plist';

// Release builds (EAS `preview` / `production`) must use the real Firebase project. These variables only
// exist on EAS build workers, so this never blocks local commands.
const easProfile = process.env.EAS_BUILD === 'true' ? process.env.EAS_BUILD_PROFILE : undefined;
if (easProfile === 'preview' || easProfile === 'production') {
  if (process.env.EAS_BUILD_PLATFORM === 'ios') {
    throw new Error(
      `iOS ${easProfile} builds are not set up yet (they need an Apple Developer account).`,
    );
  }
  if (!process.env.GOOGLE_SERVICES_JSON) {
    throw new Error(
      `The ${easProfile} build has no GOOGLE_SERVICES_JSON. Add google-services.json as an EAS file ` +
        `variable in the "${easProfile}" environment instead of shipping the demo config.`,
    );
  }
}

// Final app ID (Android package and iOS bundle ID). Case-sensitive: Firebase, EAS credentials and Google OAuth
// clients must use exactly this spelling. The demo configs in ./firebase/ must use the same ID.
const APP_ID = 'com.satyamkumar.inkwell';

// "Inkwell" is the working name — rename here (and in bundle IDs) once the final name is chosen.
const config: ExpoConfig = {
  name: 'Inkwell',
  slug: 'inkwell',
  // EAS project @saty_satyam1122/inkwell (not a secret). Set here because EAS can't write to app.config.ts.
  owner: 'saty_satyam1122',
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'inkwell',
  userInterfaceStyle: 'automatic',
  ios: {
    bundleIdentifier: APP_ID,
    googleServicesFile: googleServicesPlist,
    supportsTablet: false,
  },
  android: {
    package: APP_ID,
    googleServicesFile: googleServicesJson,
    // Android 13+ runtime permission, requested after the onboarding pre-permission screen.
    permissions: ['android.permission.POST_NOTIFICATIONS'],
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
  extra: {
    eas: { projectId: '645ea6f2-f583-4a4f-acb3-a7f6660f03fd' },
  },
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
};

export default config;
