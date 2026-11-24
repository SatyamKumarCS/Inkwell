import { beforeEach, describe, expect, it } from 'vitest';
import { Collections, spaceSchema, userSchema } from '@inkwell/shared';

import { completeProfile } from '../auth/completeProfile';
import { createCustomToken, verifyFirebaseIdToken } from '../auth/tokens';
import {
  decodeJwt,
  importPrivateKeyPem,
  importRsaPublicJwk,
  signJwtRs256,
  verifyRs256,
} from '../crypto/jwt';
import { ApiError } from '../http';
import {
  config,
  firestore,
  PROJECT,
  resetEmulators,
  signInWithCustomToken,
  testEnv,
} from './helpers';

const caller = { uid: 'ada', email: 'ada@example.com', picture: null };

beforeEach(resetEmulators);

describe('completeProfile', () => {
  it('creates the user and an owned default space', async () => {
    const db = firestore();
    const { spaceId } = await completeProfile(
      { firstName: ' Ada ', lastName: 'Lovelace' },
      caller,
      db,
    );

    const user = userSchema.parse(await db.get(`${Collections.users}/ada`));
    expect(user).toMatchObject({
      displayName: 'Ada Lovelace',
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      defaultSpaceId: spaceId,
      onboarding: {},
      settings: { theme: 'system', startOfWeek: 1 },
    });
    expect(user.createdAt.seconds).toBeGreaterThan(0); // set by the server

    const space = spaceSchema.parse(await db.get(`${Collections.spaces}/${spaceId}`));
    expect(space).toMatchObject({ ownerId: 'ada', memberIds: ['ada'], roles: { ada: 'owner' } });
  });

  it('is idempotent: a second call returns the same space and writes nothing new', async () => {
    const db = firestore();
    const first = await completeProfile({ firstName: 'Ada' }, caller, db);
    const second = await completeProfile({ firstName: 'Someone else' }, caller, db);

    expect(second.spaceId).toBe(first.spaceId);
    expect((await db.get(`${Collections.users}/ada`))?.firstName).toBe('Ada');
  });

  it('concurrent calls still create exactly one profile', async () => {
    const db = firestore();
    const results = await Promise.all([
      completeProfile({ firstName: 'Ada' }, caller, db),
      completeProfile({ firstName: 'Ada' }, caller, db),
      completeProfile({ firstName: 'Ada' }, caller, db),
    ]);
    const user = await db.get(`${Collections.users}/ada`);
    expect(new Set(results.map((r) => r.spaceId))).toEqual(new Set([user?.defaultSpaceId]));
  });

  it('requires a first name', async () => {
    await expect(completeProfile({ firstName: '  ' }, caller, firestore())).rejects.toBeInstanceOf(
      ApiError,
    );
  });
});

describe('custom tokens', () => {
  it('are RS256-signed by the service account and accepted by Firebase Auth', async () => {
    const sa = config().serviceAccount;
    const token = await createCustomToken(sa, 'ada');

    const jwt = decodeJwt(token);
    expect(jwt.header).toMatchObject({ alg: 'RS256', kid: sa.private_key_id });
    expect(jwt.payload).toMatchObject({
      uid: 'ada',
      iss: sa.client_email,
      sub: sa.client_email,
      aud: 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit',
    });
    const publicKey = await importRsaPublicJwk(
      JSON.parse(testEnv.TEST_SERVICE_ACCOUNT_PUBLIC_JWK) as JsonWebKey,
    );
    expect(await verifyRs256(jwt, publicKey)).toBe(true);

    const idToken = await signInWithCustomToken(token);
    expect(decodeJwt(idToken).payload.sub).toBe('ada');
  });
});

describe('verifyFirebaseIdToken', () => {
  const now = Date.parse('2026-11-23T10:00:00Z');
  const nowSeconds = Math.floor(now / 1000);
  const claims = (overrides: Record<string, unknown> = {}) => ({
    aud: PROJECT,
    iss: `https://securetoken.google.com/${PROJECT}`,
    sub: 'ada',
    email: 'ada@example.com',
    iat: nowSeconds - 60,
    exp: nowSeconds + 3600,
    ...overrides,
  });

  // Production mode: tokens must carry a valid RS256 signature from a published key.
  async function signed(overrides: Record<string, unknown> = {}) {
    const key = await importPrivateKeyPem(config().serviceAccount.private_key);
    return signJwtRs256(claims(overrides), key, { kid: 'k1' });
  }
  const keys = async (kid: string) =>
    kid === 'k1'
      ? importRsaPublicJwk(JSON.parse(testEnv.TEST_SERVICE_ACCOUNT_PUBLIC_JWK) as JsonWebKey)
      : null;
  const verifyProd = (token: string | null) =>
    verifyFirebaseIdToken(token, { projectId: PROJECT, emulator: false, keys, nowMs: now });

  it('accepts a correctly signed token and returns the caller', async () => {
    await expect(verifyProd(await signed())).resolves.toEqual({
      uid: 'ada',
      email: 'ada@example.com',
      picture: null,
    });
  });

  it.each<[string, Record<string, unknown>]>([
    ['another project', { aud: 'other-project' }],
    ['a different issuer', { iss: 'https://securetoken.google.com/other-project' }],
    ['an expired token', { exp: nowSeconds - 600 }],
    ['a token issued in the future', { iat: nowSeconds + 3600 }],
    ['an empty subject', { sub: '' }],
  ])('rejects %s', async (_label, overrides) => {
    await expect(verifyProd(await signed(overrides))).rejects.toMatchObject({
      code: 'unauthenticated',
    });
  });

  it('rejects unsigned tokens, unknown keys and missing tokens outside emulator mode', async () => {
    const unsigned = `${btoa('{"alg":"none"}')}.${btoa(JSON.stringify(claims()))}.`;
    await expect(verifyProd(unsigned)).rejects.toMatchObject({ code: 'unauthenticated' });
    const key = await importPrivateKeyPem(config().serviceAccount.private_key);
    const unknownKid = await signJwtRs256(claims(), key, { kid: 'k2' });
    await expect(verifyProd(unknownKid)).rejects.toMatchObject({ code: 'unauthenticated' });
    await expect(verifyProd(null)).rejects.toMatchObject({ code: 'unauthenticated' });
  });

  it('accepts the Auth emulator’s unsigned ID tokens in emulator mode', async () => {
    const idToken = await signInWithCustomToken(
      await createCustomToken(config().serviceAccount, 'ada'),
    );
    await expect(
      verifyFirebaseIdToken(idToken, { projectId: PROJECT, emulator: true, keys }),
    ).resolves.toMatchObject({ uid: 'ada' });
  });
});
