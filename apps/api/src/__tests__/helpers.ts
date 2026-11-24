import { env } from 'cloudflare:test';
import { expect } from 'vitest';
import type { AuthErrorReason } from '@inkwell/shared';

import type { Guard } from '../auth/guard';
import { loadConfig } from '../config';
import { decodeJwt } from '../crypto/jwt';
import type { AppEnv } from '../env';
import { Firestore } from '../google/firestore';
import { IdentityToolkit } from '../google/identityToolkit';
import type { AuthHeader } from '../google/rest';
import { ApiError } from '../http';
import { guardFor } from '../index';

export const testEnv = env as unknown as AppEnv & { TEST_SERVICE_ACCOUNT_PUBLIC_JWK: string };
export const PROJECT = 'demo-inkwell';
export const PEPPER = 'test-pepper';

if (!testEnv.FIRESTORE_EMULATOR_HOST || !testEnv.FIREBASE_AUTH_EMULATOR_HOST) {
  throw new Error('API tests need the emulators: run `pnpm test:api` from the repo root.');
}

export const config = () => loadConfig(testEnv);

let guardSeq = 0;
/** A fresh AuthGuard instance per test, so limits and codes never leak between tests. */
export const freshGuard = (): Guard => guardFor(testEnv, `test-${Date.now()}-${++guardSeq}`);

const owner: AuthHeader = () => Promise.resolve('Bearer owner');
export const identityToolkit = () =>
  new IdentityToolkit(PROJECT, owner, testEnv.FIREBASE_AUTH_EMULATOR_HOST);
export const firestore = () => new Firestore(PROJECT, owner, testEnv.FIRESTORE_EMULATOR_HOST);

const authBase = () =>
  `http://${testEnv.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/projects/${PROJECT}`;

/** Wipes Firestore and Auth emulator data. */
export async function resetEmulators() {
  await Promise.all([
    fetch(
      `http://${testEnv.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`,
      { method: 'DELETE' },
    ),
    fetch(
      `http://${testEnv.FIREBASE_AUTH_EMULATOR_HOST}/emulator/v1/projects/${PROJECT}/accounts`,
      {
        method: 'DELETE',
      },
    ),
  ]);
}

export interface EmulatorUser {
  localId: string;
  email?: string;
  emailVerified?: boolean;
  providerUserInfo?: { providerId: string }[];
}

export async function listUsers(): Promise<EmulatorUser[]> {
  const response = await fetch(`${authBase()}/accounts:batchGet?maxResults=100`, {
    headers: { authorization: 'Bearer owner' },
  });
  return ((await response.json()) as { users?: EmulatorUser[] }).users ?? [];
}

/** Exchanges a custom token at the Auth emulator, like the app does. Returns the ID token. */
export async function signInWithCustomToken(token: string): Promise<string> {
  const response = await fetch(
    `http://${testEnv.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=fake-api-key`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token, returnSecureToken: true }),
    },
  );
  const body = (await response.json()) as { idToken?: string; error?: unknown };
  if (!body.idToken) throw new Error(`signInWithCustomToken failed: ${JSON.stringify(body.error)}`);
  return body.idToken;
}

export const customTokenUid = (token: string) => decodeJwt(token).payload.uid as string;

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
  expect(error).toBeInstanceOf(ApiError);
  expect((error as ApiError).details).toMatchObject({ reason, ...details });
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
