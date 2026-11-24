import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/logger';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  checkGoogleClaims,
  signInWithGoogle,
  type GoogleTokenVerifier,
  type SignInWithGoogleDeps,
} from '../auth/google';
import { requestEmailCode } from '../auth/requestEmailCode';
import { verifyEmailCode } from '../auth/verifyEmailCode';
import { clock, customTokenUid, expectAuthError, resetEmulators } from './helpers';

const db = getFirestore();
const auth = getAuth();
const AUDIENCE = '1234-web.apps.googleusercontent.com';
const PEPPER = 'test-pepper';

let time: ReturnType<typeof clock>;
const nowSeconds = () => Math.floor(time.now().getTime() / 1000);

/** Claims of a valid Google ID token; tests override fields. */
function claims(overrides: Record<string, unknown> = {}) {
  return {
    iss: 'https://accounts.google.com',
    aud: AUDIENCE,
    sub: 'google-sub-ada',
    email: 'Ada@Example.com',
    email_verified: true,
    name: 'Ada Lovelace',
    given_name: 'Ada',
    family_name: 'Lovelace',
    iat: nowSeconds(),
    exp: nowSeconds() + 3600,
    ...overrides,
  };
}

/** Stands in for Google's signature check: the "token" is the JSON of its claims. */
const fakeVerifier: GoogleTokenVerifier = async (idToken) => JSON.parse(idToken) as unknown;
const token = (overrides: Record<string, unknown> = {}) => JSON.stringify(claims(overrides));

function deps(overrides: Partial<SignInWithGoogleDeps> = {}): SignInWithGoogleDeps {
  return {
    db,
    auth,
    audience: AUDIENCE,
    ipKey: '198.51.100.1',
    ipPerHour: 10,
    verify: fakeVerifier,
    now: time.now,
    ...overrides,
  };
}

const google = (idToken: string, overrides: Partial<SignInWithGoogleDeps> = {}) =>
  signInWithGoogle({ idToken }, deps(overrides));

/** Signs in with an email code end to end and returns the account's uid. */
async function emailCodeSignIn(email: string): Promise<string> {
  let code = '';
  await requestEmailCode(
    { email },
    {
      db,
      pepper: PEPPER,
      ipKey: '198.51.100.9',
      limits: { ttlSeconds: 600, ipPerHour: 10, dailyCap: 200 },
      now: time.now,
      sendCode: async (_to, sentCode) => {
        code = sentCode;
      },
    },
  );
  const { token: customToken } = await verifyEmailCode(
    { email, code },
    { db, auth, pepper: PEPPER, now: time.now },
  );
  return customTokenUid(customToken);
}

const providers = async (uid: string) =>
  (await auth.getUser(uid)).providerData.map((p) => p.providerId);

beforeEach(async () => {
  await resetEmulators();
  time = clock();
});

describe('checkGoogleClaims', () => {
  const check = (overrides: Record<string, unknown>) =>
    checkGoogleClaims(claims(overrides), { audience: AUDIENCE, nowMs: time.now().getTime() });

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
    ['the googleapis.com issuer the library would allow', { iss: 'googleapis.com' }],
    ['an expired token', { exp: 1 }],
    ['a token expiring right now', { exp: Math.floor(Date.parse('2026-11-23T10:00:00Z') / 1000) }],
    ['a missing subject', { sub: '' }],
    ['a missing email', { email: undefined }],
  ])('rejects %s as an invalid token', (_label, overrides) => {
    try {
      check(overrides);
      throw new Error('expected a rejection');
    } catch (error) {
      expect((error as HttpsError).details).toMatchObject({ reason: 'invalid-google-token' });
    }
  });

  it.each<[string, unknown]>([
    ['false', false],
    ['missing', undefined],
    ['the string "true"', 'true'],
  ])('rejects email_verified = %s', (_label, value) => {
    expect(() => check({ email_verified: value })).toThrow(HttpsError);
    try {
      check({ email_verified: value });
    } catch (error) {
      expect((error as HttpsError).details).toMatchObject({ reason: 'email-not-verified' });
    }
  });
});

describe('signInWithGoogle', () => {
  it('creates a new account with Google linked and returns the name for prefilling', async () => {
    const result = await google(token());

    const user = await auth.getUser(customTokenUid(result.token));
    expect(user.email).toBe('ada@example.com');
    expect(user.emailVerified).toBe(true);
    expect(await providers(user.uid)).toContain('google.com');
    expect(result).toMatchObject({ firstName: 'Ada', lastName: 'Lovelace' });
  });

  it('signs a returning Google user into the same account', async () => {
    const first = await google(token());
    const second = await google(token());
    expect(customTokenUid(second.token)).toBe(customTokenUid(first.token));
    expect((await auth.listUsers()).users).toHaveLength(1);
  });

  it('linking, email code first: Google lands in the existing account and links to it', async () => {
    const emailUid = await emailCodeSignIn('ada@example.com');
    expect(await providers(emailUid)).not.toContain('google.com');

    const result = await google(token());

    expect(customTokenUid(result.token)).toBe(emailUid);
    expect(await providers(emailUid)).toContain('google.com');
    expect((await auth.listUsers()).users).toHaveLength(1);
  });

  it('linking, Google first: an email code lands in the Google account', async () => {
    const googleUid = customTokenUid((await google(token())).token);

    const emailUid = await emailCodeSignIn('ADA@example.com');

    expect(emailUid).toBe(googleUid);
    expect((await auth.listUsers()).users).toHaveLength(1);
  });

  it('rejects an unverified Google email and creates no account', async () => {
    await expectAuthError(google(token({ email_verified: false })), 'email-not-verified');
    expect((await auth.listUsers()).users).toHaveLength(0);
  });

  it('rejects a token that fails Google’s signature check', async () => {
    const verify = vi.fn<GoogleTokenVerifier>().mockRejectedValue(new Error('Invalid signature'));
    await expectAuthError(google('forged', { verify }), 'invalid-google-token');
    expect((await auth.listUsers()).users).toHaveLength(0);
  });

  it('checks the token against our Web client ID', async () => {
    const verify = vi.fn(fakeVerifier);
    await google(token(), { verify });
    expect(verify).toHaveBeenCalledWith(expect.any(String), AUDIENCE);
  });

  it('applies the per-IP limit before verifying', async () => {
    const verify = vi.fn(fakeVerifier);
    await google(token(), { ipPerHour: 2, verify });
    await google(token(), { ipPerHour: 2, verify });
    await expectAuthError(google(token(), { ipPerHour: 2, verify }), 'rate-limited');
    expect(verify).toHaveBeenCalledTimes(2);
    // Another IP is unaffected.
    await expect(google(token(), { ipPerHour: 2, ipKey: '203.0.113.5' })).resolves.toBeDefined();
  });

  it('without a reliable IP: skips the per-IP limit instead of sharing one bucket, and warns', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    for (let i = 0; i < 3; i++) await google(token(), { ipPerHour: 1, ipKey: null });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('per-IP limit'));
    warn.mockRestore();
  });

  it('refuses to run when no Web client ID is configured', async () => {
    await expect(google(token(), { audience: '' })).rejects.toMatchObject({
      code: 'failed-precondition',
    });
  });
});
