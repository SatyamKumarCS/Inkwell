import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-inkwell',
    firestore: {
      rules: readFileSync(resolve(import.meta.dirname, '../../firestore.rules'), 'utf8'),
    },
  });
});

afterAll(async () => {
  await env?.cleanup();
});

const created = Timestamp.fromMillis(Date.parse('2026-11-01T00:00:00Z'));

const aliceProfile = {
  displayName: 'Alice Liddell',
  firstName: 'Alice',
  lastName: 'Liddell',
  email: 'alice@example.com',
  photoURL: null,
  defaultSpaceId: 'space-alice',
  settings: { theme: 'system', startOfWeek: 1 },
  fcmTokens: [],
  onboarding: {},
  createdAt: created,
  updatedAt: created,
};

const aliceSpace = {
  name: 'Personal',
  icon: '🏠',
  ownerId: 'alice',
  memberIds: ['alice'],
  roles: { alice: 'owner' },
  createdAt: created,
  updatedAt: created,
};

const alice = () => env.authenticatedContext('alice').firestore();
const bob = () => env.authenticatedContext('bob').firestore();
const anon = () => env.unauthenticatedContext().firestore();

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'users/alice'), aliceProfile);
    await setDoc(doc(db, 'spaces/space-alice'), aliceSpace);
    await setDoc(doc(db, 'emailCodes/abc'), { codeHash: 'x', attempts: 0 });
    await setDoc(doc(db, 'rateLimits/daily-2026-11-23'), { count: 1 });
  });
});

describe('users/{uid}', () => {
  it('lets a user read their own profile', async () => {
    await assertSucceeds(getDoc(doc(alice(), 'users/alice')));
  });

  it("denies reading someone else's profile, signed in or not", async () => {
    await assertFails(getDoc(doc(bob(), 'users/alice')));
    await assertFails(getDoc(doc(anon(), 'users/alice')));
  });

  it('denies creating or deleting a profile from the app', async () => {
    await assertFails(setDoc(doc(bob(), 'users/bob'), { ...aliceProfile, email: 'bob@x.com' }));
    await assertFails(deleteDoc(doc(alice(), 'users/alice')));
  });

  it('allows editing name, settings and onboarding progress', async () => {
    await assertSucceeds(
      updateDoc(doc(alice(), 'users/alice'), {
        displayName: 'Alice L',
        firstName: 'Alice',
        lastName: 'L',
        'settings.theme': 'dark',
        'onboarding.tourCompletedAt': serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
    await assertSucceeds(
      updateDoc(doc(alice(), 'users/alice'), {
        'onboarding.notificationsPromptedAt': serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it('requires updatedAt to be the server time', async () => {
    await assertFails(
      updateDoc(doc(alice(), 'users/alice'), { firstName: 'Al', updatedAt: created }),
    );
  });

  it.each([
    ['email', { email: 'evil@example.com' }],
    ['defaultSpaceId', { defaultSpaceId: 'someone-elses-space' }],
    ['fcmTokens', { fcmTokens: ['token'] }],
    ['createdAt', { createdAt: serverTimestamp() }],
    ['an unknown field', { isAdmin: true }],
  ])('denies changing %s', async (_label, change) => {
    await assertFails(
      updateDoc(doc(alice(), 'users/alice'), { ...change, updatedAt: serverTimestamp() }),
    );
  });

  it.each([
    ['an empty first name', { firstName: '' }],
    ['a 51-character last name', { lastName: 'x'.repeat(51) }],
    ['an unknown theme', { 'settings.theme': 'neon' }],
    ['an unknown settings key', { 'settings.fontSize': 20 }],
    ['an unknown onboarding key', { 'onboarding.skipped': true }],
    ['a non-timestamp onboarding value', { 'onboarding.tourCompletedAt': 'yesterday' }],
  ])('denies %s', async (_label, change) => {
    await assertFails(
      updateDoc(doc(alice(), 'users/alice'), { ...change, updatedAt: serverTimestamp() }),
    );
  });

  it("denies editing someone else's profile", async () => {
    await assertFails(
      updateDoc(doc(bob(), 'users/alice'), { firstName: 'Bob', updatedAt: serverTimestamp() }),
    );
  });
});

describe('spaces/{spaceId}', () => {
  it('lets members read a space', async () => {
    await assertSucceeds(getDoc(doc(alice(), 'spaces/space-alice')));
  });

  it('denies non-members and signed-out users', async () => {
    await assertFails(getDoc(doc(bob(), 'spaces/space-alice')));
    await assertFails(getDoc(doc(anon(), 'spaces/space-alice')));
  });

  it('denies all writes from the app in Phase 1, even by the owner', async () => {
    await assertFails(updateDoc(doc(alice(), 'spaces/space-alice'), { name: 'Renamed' }));
    await assertFails(setDoc(doc(alice(), 'spaces/new'), { ...aliceSpace }));
    await assertFails(deleteDoc(doc(alice(), 'spaces/space-alice')));
  });
});

describe('server-only collections', () => {
  for (const path of ['emailCodes/abc', 'rateLimits/daily-2026-11-23']) {
    it(`denies all client access to ${path}`, async () => {
      await assertFails(getDoc(doc(alice(), path)));
      await assertFails(getDoc(doc(anon(), path)));
      await assertFails(setDoc(doc(alice(), path), { count: 0 }));
      await assertFails(deleteDoc(doc(alice(), path)));
    });
  }
});

describe('collections not opened yet', () => {
  for (const path of ['docs/d1', 'tasks/t1', 'publicDocs/slug', 'config/aiModels']) {
    it(`denies read and write of ${path}`, async () => {
      await assertFails(getDoc(doc(alice(), path)));
      await assertFails(setDoc(doc(alice(), path), { x: 1 }));
    });
  }
});
