import type { Auth } from 'firebase-admin/auth';
import type { Firestore } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { OAuth2Client } from 'google-auth-library';
import {
  emailAddressSchema,
  signInWithGoogleRequestSchema,
  type SignInWithGoogleResponse,
} from '@inkwell/shared';

import { authError } from './errors';
import { consumeIpLimit } from './ipLimit';
import { findOrLinkProviderUser, type ProviderIdentity } from './users';

/** Google ID tokens are issued by exactly these (the library would also accept `googleapis.com`). */
export const GOOGLE_ISSUERS = ['accounts.google.com', 'https://accounts.google.com'];

/** Checks a Google ID token's signature and returns its claims. Throws if it is not a valid token. */
export type GoogleTokenVerifier = (idToken: string, audience: string) => Promise<unknown>;

const client = new OAuth2Client({ issuers: GOOGLE_ISSUERS });

export const verifyWithGoogle: GoogleTokenVerifier = async (idToken, audience) =>
  (await client.verifyIdToken({ idToken, audience })).getPayload();

interface GoogleClaims {
  aud?: unknown;
  iss?: unknown;
  exp?: unknown;
  sub?: unknown;
  email?: unknown;
  email_verified?: unknown;
  given_name?: unknown;
  family_name?: unknown;
  name?: unknown;
  picture?: unknown;
}

const optionalString = (value: unknown) =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;

/**
 * Our own check of the claims we rely on, on top of the library's verification: audience (our Web client
 * ID), issuer, expiry, and a verified email (`email_verified` must be exactly `true`).
 */
export function checkGoogleClaims(
  payload: unknown,
  { audience, nowMs }: { audience: string; nowMs: number },
): ProviderIdentity & { firstName?: string; lastName?: string } {
  const claims = (payload ?? {}) as GoogleClaims;
  const invalid = () =>
    authError('invalid-google-token', 'Google sign-in failed. Please try again.');

  if (claims.aud !== audience) throw invalid();
  if (typeof claims.iss !== 'string' || !GOOGLE_ISSUERS.includes(claims.iss)) throw invalid();
  if (typeof claims.exp !== 'number' || claims.exp * 1000 <= nowMs) throw invalid();
  if (typeof claims.sub !== 'string' || !claims.sub) throw invalid();

  const email = emailAddressSchema.safeParse(claims.email);
  if (!email.success) throw invalid();
  if (claims.email_verified !== true) {
    throw authError('email-not-verified', 'Your Google account email is not verified.');
  }

  return {
    providerId: 'google.com',
    providerUid: claims.sub,
    email: email.data,
    displayName: optionalString(claims.name),
    photoURL: optionalString(claims.picture),
    firstName: optionalString(claims.given_name),
    lastName: optionalString(claims.family_name),
  };
}

export interface SignInWithGoogleDeps {
  db: Firestore;
  auth: Auth;
  /** Our Web client ID — the audience Google issues the app's ID tokens for. */
  audience: string;
  ipKey: string | null;
  ipPerHour: number;
  verify: GoogleTokenVerifier;
  now?: () => Date;
}

/**
 * Verifies a Google ID token from the app and returns a custom token for the one account that owns the
 * email, linking Google to it if needed. The per-IP limit is checked before any verification work.
 */
export async function signInWithGoogle(
  input: unknown,
  deps: SignInWithGoogleDeps,
): Promise<SignInWithGoogleResponse> {
  if (!deps.audience) {
    throw new HttpsError('failed-precondition', 'Google sign-in is not configured.');
  }
  const request = signInWithGoogleRequestSchema.safeParse(input);
  if (!request.success) {
    throw authError('invalid-google-token', 'Google sign-in failed. Please try again.');
  }
  const nowMs = (deps.now ?? (() => new Date()))().getTime();

  const limit = await consumeIpLimit(deps.db, {
    scope: 'google',
    ipKey: deps.ipKey,
    perHour: deps.ipPerHour,
    nowMs,
  });
  if (limit && !limit.allowed) {
    throw authError('rate-limited', 'Too many sign-in attempts.', {
      retryAfterSeconds: limit.retryAfterSeconds,
    });
  }

  let payload: unknown;
  try {
    payload = await deps.verify(request.data.idToken, deps.audience);
  } catch {
    throw authError('invalid-google-token', 'Google sign-in failed. Please try again.');
  }
  const { firstName, lastName, ...identity } = checkGoogleClaims(payload, {
    audience: deps.audience,
    nowMs,
  });

  const user = await findOrLinkProviderUser(deps.auth, identity);
  return { token: await deps.auth.createCustomToken(user.uid), firstName, lastName };
}
