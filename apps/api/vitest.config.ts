import { generateKeyPairSync } from 'node:crypto';
import { cloudflareTest } from '@cloudflare/vitest-pool-workers';
import { defineConfig } from 'vitest/config';

// A throwaway service-account key per test run: tests sign real RS256 custom tokens without any key
// ever being committed. The emulators don't check signatures; the public key lets tests verify them.
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const serviceAccount = {
  type: 'service_account',
  project_id: 'demo-inkwell',
  private_key_id: 'test-key',
  private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
  client_email: 'inkwell-api@demo-inkwell.iam.gserviceaccount.com',
};

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './wrangler.jsonc' },
      miniflare: {
        bindings: {
          FIREBASE_PROJECT_ID: 'demo-inkwell',
          GOOGLE_WEB_CLIENT_ID: '1234-web.apps.googleusercontent.com',
          OTP_PEPPER: 'test-pepper',
          RESEND_API_KEY: 'unused-in-tests',
          GOOGLE_SERVICE_ACCOUNT: JSON.stringify(serviceAccount),
          TEST_SERVICE_ACCOUNT_PUBLIC_JWK: JSON.stringify(publicKey.export({ format: 'jwk' })),
          // Set by `firebase emulators:exec` (see the root test:api script).
          FIRESTORE_EMULATOR_HOST: process.env.FIRESTORE_EMULATOR_HOST ?? '',
          FIREBASE_AUTH_EMULATOR_HOST: process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '',
        },
      },
    }),
  ],
  test: {
    // Integration tests share the emulators and clear them between tests.
    fileParallelism: false,
    testTimeout: 20_000,
  },
});
