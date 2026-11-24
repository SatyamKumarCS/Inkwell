import { beforeEach, describe, expect, it, vi } from 'vitest';

import { requestEmailCode, verifyEmailCode } from '../auth/emailCode';
import {
  signInWithGoogle,
  type GoogleTokenVerifier,
  type SignInWithGoogleDeps,
} from '../auth/google';
import type { Guard } from '../auth/guard';
import { verifyGoogleIdTokenSignature } from '../auth/tokens';
import { signJwtRs256 } from '../crypto/jwt';
import {
  clock,
  config,
  customTokenUid,
  expectAuthError,
  freshGuard,
  identityToolkit,
  listUsers,
  PEPPER,
  resetEmulators,
} from './helpers';

const AUDIENCE = '1234-web.apps.googleusercontent.com';

let time: ReturnType<typeof clock>;
let guard: Guard;
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
    guard,
    idt: identityToolkit(),
    serviceAccount: config().serviceAccount,
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
      guard,
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
    {
      guard,
      idt: identityToolkit(),
      pepper: PEPPER,
      serviceAccount: config().serviceAccount,
      now: time.now,
    },
  );
  return customTokenUid(customToken);
}

async function providers(uid: string) {
  const user = (await listUsers()).find((u) => u.localId === uid);
  return user?.providerUserInfo?.map((p) => p.providerId) ?? [];
}

beforeEach(async () => {
  await resetEmulators();
  time = clock();
  guard = freshGuard();
});

describe('signInWithGoogle', () => {
  it('creates a new account with Google linked and returns the name for prefilling', async () => {
    const result = await google(token());

    const users = await listUsers();
    expect(users).toHaveLength(1);
    expect(users[0]).toMatchObject({ email: 'ada@example.com', emailVerified: true });
    expect(customTokenUid(result.token)).toBe(users[0]?.localId);
    expect(await providers(customTokenUid(result.token))).toContain('google.com');
    expect(result).toMatchObject({ firstName: 'Ada', lastName: 'Lovelace' });
  });

  it('signs a returning Google user into the same account', async () => {
    const first = await google(token());
    const second = await google(token());
    expect(customTokenUid(second.token)).toBe(customTokenUid(first.token));
    expect(await listUsers()).toHaveLength(1);
  });

  it('linking, email code first: Google lands in the existing account and links to it', async () => {
    const emailUid = await emailCodeSignIn('ada@example.com');
    expect(await providers(emailUid)).not.toContain('google.com');

    const result = await google(token());

    expect(customTokenUid(result.token)).toBe(emailUid);
    expect(await providers(emailUid)).toContain('google.com');
    expect(await listUsers()).toHaveLength(1);
  });

  it('linking, Google first: an email code lands in the Google account', async () => {
    const googleUid = customTokenUid((await google(token())).token);

    const emailUid = await emailCodeSignIn('ADA@example.com');

    expect(emailUid).toBe(googleUid);
    expect(await listUsers()).toHaveLength(1);
  });

  it('rejects an unverified Google email and creates no account', async () => {
    await expectAuthError(google(token({ email_verified: false })), 'email-not-verified');
    expect(await listUsers()).toHaveLength(0);
  });

  it('rejects a token that fails the signature check', async () => {
    const verify = vi.fn<GoogleTokenVerifier>().mockRejectedValue(new Error('Invalid signature'));
    await expectAuthError(google('forged', { verify }), 'invalid-google-token');
    expect(await listUsers()).toHaveLength(0);
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
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
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

describe('Google ID token signature check', () => {
  async function keyPair() {
    return (await crypto.subtle.generateKey(
      {
        name: 'RSASSA-PKCS1-v1_5',
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: 'SHA-256',
      },
      false,
      ['sign', 'verify'],
    )) as CryptoKeyPair;
  }

  it('accepts a token signed by a key Google publishes, and returns its claims', async () => {
    time = clock();
    const google = await keyPair();
    const jwt = await signJwtRs256(claims(), google.privateKey, { kid: 'g1' });
    const payload = await verifyGoogleIdTokenSignature(jwt, async (kid) =>
      kid === 'g1' ? google.publicKey : null,
    );
    expect(payload).toMatchObject({ sub: 'google-sub-ada', aud: AUDIENCE });
  });

  it('rejects a token signed by any other key, or with an unknown key id', async () => {
    time = clock();
    const google = await keyPair();
    const attacker = await keyPair();
    const forged = await signJwtRs256(claims(), attacker.privateKey, { kid: 'g1' });
    await expect(
      verifyGoogleIdTokenSignature(forged, async () => google.publicKey),
    ).rejects.toThrow();
    const unknownKid = await signJwtRs256(claims(), google.privateKey, { kid: 'other' });
    await expect(
      verifyGoogleIdTokenSignature(unknownKid, async (kid) =>
        kid === 'g1' ? google.publicKey : null,
      ),
    ).rejects.toThrow();
  });
});
