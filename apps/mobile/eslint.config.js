// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'android/*', 'ios/*', '.expo/*'],
  },
  {
    // eslint-plugin-react 7.x has no ESLint 10 release yet, and its React version auto-detection calls the
    // removed context.getFilename(). An explicit version skips detection.
    settings: { react: { version: require('react/package.json').version } },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      // Firestore access goes through @/lib/db so every read/write is counted (Spark quota, SPEC.md §1.1).
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@react-native-firebase/firestore',
              message:
                'Use @/lib/db: it counts reads/writes against the Spark quota in dev builds.',
            },
          ],
        },
      ],
    },
  },
  {
    // The Firestore wrapper itself, emulator setup, and tests that drive the mocked SDK.
    files: ['src/lib/db.ts', 'src/lib/firebase.ts', '**/__tests__/**'],
    rules: { 'no-restricted-imports': 'off' },
  },
]);
