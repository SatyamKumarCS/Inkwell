import { getFirestore } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { beforeEach, describe, expect, it } from 'vitest';
import { Collections, FUNCTIONS_REGION, spaceSchema, userSchema } from '@inkwell/shared';

import { completeProfile } from '../auth/completeProfile';
import { resetEmulators } from './helpers';

const db = getFirestore();
const caller = { uid: 'ada', email: 'ada@example.com', photoURL: null };

beforeEach(resetEmulators);

describe('completeProfile', () => {
  it('creates the user and an owned default space', async () => {
    const { spaceId } = await completeProfile(
      { firstName: ' Ada ', lastName: 'Lovelace' },
      caller,
      db,
    );

    const user = userSchema.parse((await db.doc(`${Collections.users}/ada`).get()).data());
    expect(user).toMatchObject({
      displayName: 'Ada Lovelace',
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      defaultSpaceId: spaceId,
      onboarding: {},
    });

    const space = spaceSchema.parse(
      (await db.doc(`${Collections.spaces}/${spaceId}`).get()).data(),
    );
    expect(space).toMatchObject({ ownerId: 'ada', memberIds: ['ada'], roles: { ada: 'owner' } });
  });

  it('is idempotent: a second call returns the same space and writes nothing new', async () => {
    const first = await completeProfile({ firstName: 'Ada' }, caller, db);
    const second = await completeProfile({ firstName: 'Someone else' }, caller, db);

    expect(second.spaceId).toBe(first.spaceId);
    expect((await db.collection(Collections.spaces).get()).size).toBe(1);
    expect((await db.doc(`${Collections.users}/ada`).get()).get('firstName')).toBe('Ada');
  });

  it('requires a first name', async () => {
    await expect(completeProfile({ firstName: '  ' }, caller, db)).rejects.toBeInstanceOf(
      HttpsError,
    );
  });
});

describe('deployment config', () => {
  it(`deploys every function to ${FUNCTIONS_REGION}`, async () => {
    const functions = await import('../index');
    for (const fn of Object.values(functions)) {
      expect((fn as { __endpoint: { region?: string[] } }).__endpoint.region).toEqual([
        FUNCTIONS_REGION,
      ]);
    }
  });
});
