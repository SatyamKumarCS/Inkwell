import { emailAddressSchema } from '@inkwell/shared';

import { authError } from './errors';
import type { ProviderIdentity } from './types';

/** Google ID tokens are issued by exactly these (Google's own libraries would also accept `googleapis.com`). */
export const GOOGLE_ISSUERS = ['accounts.google.com', 'https://accounts.google.com'];

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
 * Checks the claims we rely on, after the signature has been verified: audience (our Web client ID),
 * issuer, expiry, and a verified email (`email_verified` must be exactly `true`).
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
