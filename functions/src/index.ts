import './options'; // must stay first: sets the region before any function is defined
import { onRequest } from 'firebase-functions/v2/https';

import {
  completeProfileFn,
  requestEmailCodeFn,
  signInWithGoogleFn,
  verifyEmailCodeFn,
} from './auth/callables';

// Later phases add notifications (3), AI (4) and publishing (5).

/** Lets local dev confirm the Functions emulator is running. Returns no data. */
export const healthcheck = onRequest((_req, res) => {
  res.json({ ok: true });
});

// Export names must match `Callables` in @inkwell/shared.
export const requestEmailCode = requestEmailCodeFn;
export const verifyEmailCode = verifyEmailCodeFn;
export const completeProfile = completeProfileFn;
export const signInWithGoogle = signInWithGoogleFn;
