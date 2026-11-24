import { initializeApp } from 'firebase-admin/app';

// Run through `pnpm test:functions` (or `pnpm test`), which starts the Auth and Firestore emulators.
if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  throw new Error(
    'Functions tests need the emulators: run `pnpm test:functions` from the repo root.',
  );
}

initializeApp({ projectId: 'demo-inkwell' });
