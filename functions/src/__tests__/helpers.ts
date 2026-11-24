import { HttpsError } from 'firebase-functions/v2/https';
import { expect } from 'vitest';
import type { AuthErrorReason } from '@inkwell/shared';

const PROJECT = 'demo-inkwell';

/** Wipes Firestore and Auth emulator data. */
export async function resetEmulators() {
  const firestore = process.env.FIRESTORE_EMULATOR_HOST;
  const auth = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  await Promise.all([
    fetch(`http://${firestore}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, {
      method: 'DELETE',
    }),
    fetch(`http://${auth}/emulator/v1/projects/${PROJECT}/accounts`, { method: 'DELETE' }),
  ]);
}

export async function expectAuthError(
  promise: Promise<unknown>,
  reason: AuthErrorReason,
  details: Record<string, unknown> = {},
) {
  const error = await promise.then(
    () => {
      throw new Error(`Expected an auth error "${reason}" but the call succeeded`);
    },
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(HttpsError);
  expect((error as HttpsError).details).toMatchObject({ reason, ...details });
}

/** The `uid` claim of a custom token (unsigned in the emulator, but the payload is the same). */
export function customTokenUid(token: string): string {
  const payload = token.split('.')[1] ?? '';
  return (JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { uid: string }).uid;
}

/** A controllable clock. */
export function clock(start = Date.parse('2026-11-23T10:00:00Z')) {
  let now = start;
  return {
    now: () => new Date(now),
    advance: (ms: number) => {
      now += ms;
    },
  };
}
