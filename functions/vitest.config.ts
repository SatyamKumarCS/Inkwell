import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Integration tests share one emulator instance and clear it between tests, so run files serially.
    fileParallelism: false,
    testTimeout: 15_000,
    setupFiles: ['./src/__tests__/setup.ts'],
  },
});
