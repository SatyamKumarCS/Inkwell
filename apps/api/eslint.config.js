import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['worker-configuration.d.ts', '.wrangler/**'] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    // Dev scripts run in Node, not the Workers runtime.
    files: ['scripts/**'],
    languageOptions: { globals: { process: 'readonly', console: 'readonly', URL: 'readonly' } },
  },
);
