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
    },
  },
]);
