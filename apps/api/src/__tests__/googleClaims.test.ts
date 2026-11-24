import { describe, expect, it } from 'vitest';

import { checkGoogleClaims } from '../auth/googleClaims';
import { ApiError } from '../http';

const AUDIENCE = '1234-web.apps.googleusercontent.com';
const NOW = Date.parse('2026-11-23T10:00:00Z');
const nowSeconds = Math.floor(NOW / 1000);

const claims = (overrides: Record<string, unknown> = {}) => ({
  iss: 'https://accounts.google.com',
  aud: AUDIENCE,
  sub: 'google-sub-ada',
  email: 'Ada@Example.com',
  email_verified: true,
  name: 'Ada Lovelace',
  given_name: 'Ada',
  family_name: 'Lovelace',
  iat: nowSeconds,
  exp: nowSeconds + 3600,
  ...overrides,
});

const check = (overrides: Record<string, unknown>) =>
  checkGoogleClaims(claims(overrides), { audience: AUDIENCE, nowMs: NOW });

function reasonOf(fn: () => unknown): unknown {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(ApiError);
    return (error as ApiError).details?.reason;
  }
  throw new Error('expected a rejection');
}

describe('checkGoogleClaims', () => {
  it('returns the normalised identity and name for a valid token', () => {
    expect(check({})).toMatchObject({
      providerId: 'google.com',
      providerUid: 'google-sub-ada',
      email: 'ada@example.com',
      firstName: 'Ada',
      lastName: 'Lovelace',
    });
  });

  it.each<[string, Record<string, unknown>]>([
    ['another app’s audience', { aud: 'someone-else.apps.googleusercontent.com' }],
    ['a missing audience', { aud: undefined }],
    ['a non-Google issuer', { iss: 'https://evil.example.com' }],
    ['the googleapis.com issuer', { iss: 'googleapis.com' }],
    ['an expired token', { exp: 1 }],
    ['a token expiring right now', { exp: nowSeconds }],
    ['a missing subject', { sub: '' }],
    ['a missing email', { email: undefined }],
  ])('rejects %s as an invalid token', (_label, overrides) => {
    expect(reasonOf(() => check(overrides))).toBe('invalid-google-token');
  });

  it.each<[string, unknown]>([
    ['false', false],
    ['missing', undefined],
    ['the string "true"', 'true'],
  ])('rejects email_verified = %s', (_label, value) => {
    expect(reasonOf(() => check({ email_verified: value }))).toBe('email-not-verified');
  });
});
