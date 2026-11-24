import { signInWithGoogleRequestSchema, type SignInWithGoogleResponse } from '@inkwell/shared';

import type { ServiceAccount } from '../config';
import { sha256Hex } from '../crypto/hash';
import type { IdentityToolkit } from '../google/identityToolkit';
import { ApiError } from '../http';
import { authError } from './errors';
import { checkGoogleClaims } from './googleClaims';
import { warnUnknownIp, type Guard } from './guard';
import { createCustomToken } from './tokens';
import { findOrLinkProviderUser } from './users';

/** Checks a Google ID token's signature and returns its claims. Throws if it is not a valid token. */
export type GoogleTokenVerifier = (idToken: string) => Promise<unknown>;

export interface SignInWithGoogleDeps {
  guard: Guard;
  idt: IdentityToolkit;
  serviceAccount: ServiceAccount;
  /** Our Web client ID: the audience Google issues the app's ID tokens for. */
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
    throw new ApiError('failed-precondition', 'Google sign-in is not configured.');
  }
  const request = signInWithGoogleRequestSchema.safeParse(input);
  if (!request.success) {
    throw authError('invalid-google-token', 'Google sign-in failed. Please try again.');
  }
  const nowMs = (deps.now ?? (() => new Date()))().getTime();

  if (deps.ipKey) {
    const limit = await deps.guard.consumeIp({
      scope: 'google',
      ipHash: await sha256Hex(deps.ipKey),
      nowMs,
      perHour: deps.ipPerHour,
    });
    if (!limit.allowed) {
      throw authError('rate-limited', 'Too many sign-in attempts.', {
        retryAfterSeconds: limit.retryAfterSeconds,
      });
    }
  } else {
    warnUnknownIp('signInWithGoogle');
  }

  let payload: unknown;
  try {
    payload = await deps.verify(request.data.idToken);
  } catch {
    throw authError('invalid-google-token', 'Google sign-in failed. Please try again.');
  }
  const { firstName, lastName, ...identity } = checkGoogleClaims(payload, {
    audience: deps.audience,
    nowMs,
  });

  const user = await findOrLinkProviderUser(deps.idt, identity);
  return {
    token: await createCustomToken(deps.serviceAccount, user.uid, nowMs),
    firstName,
    lastName,
  };
}
