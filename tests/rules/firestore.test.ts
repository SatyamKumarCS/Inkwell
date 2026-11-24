import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  where,
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
  for (const path of ['folders/f1', 'publicDocs/slug', 'config/aiModels']) {
    it(`denies read and write of ${path}`, async () => {
      await assertFails(getDoc(doc(alice(), path)));
      await assertFails(setDoc(doc(alice(), path), { x: 1 }));
    });
  }
});

// --- Docs, blocks, tasks, task lists, stars (owner-only demo scope) -------------------------------------

const newDoc = (ownerId: string, spaceId = `space-${ownerId}`) => ({
  spaceId,
  ownerId,
  title: 'Plan',
  icon: null,
  sharedWith: [],
  linkSharing: 'off',
  published: false,
  isDailyNote: false,
  deleted: false,
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
});

const seedDoc = (id: string, ownerId: string) =>
  env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `docs/${id}`), {
      ...newDoc(ownerId),
      createdAt: created,
      updatedAt: created,
    });
  });

describe('docs/{docId}', () => {
  it('lets the owner create a doc in their own space', async () => {
    await assertSucceeds(setDoc(doc(alice(), 'docs/d1'), newDoc('alice')));
  });

  it('refuses docs for someone else, in a space the caller is not in, or without server timestamps', async () => {
    await assertFails(setDoc(doc(alice(), 'docs/d1'), newDoc('bob', 'space-alice')));
    await assertFails(setDoc(doc(bob(), 'docs/d1'), newDoc('bob', 'space-alice')));
    await assertFails(setDoc(doc(alice(), 'docs/d1'), { ...newDoc('alice'), createdAt: created }));
    await assertFails(setDoc(doc(anon(), 'docs/d1'), newDoc('alice')));
  });

  it('lets only the owner read, list, update and delete', async () => {
    await seedDoc('d1', 'alice');
    await assertSucceeds(getDoc(doc(alice(), 'docs/d1')));
    await assertSucceeds(
      getDocs(query(collection(alice(), 'docs'), where('ownerId', '==', 'alice'))),
    );
    await assertSucceeds(
      updateDoc(doc(alice(), 'docs/d1'), { title: 'New', updatedAt: serverTimestamp() }),
    );
    await assertFails(getDoc(doc(bob(), 'docs/d1')));
    await assertFails(getDocs(collection(bob(), 'docs')));
    await assertFails(updateDoc(doc(bob(), 'docs/d1'), { title: 'x', updatedAt: serverTimestamp() }));
    await assertFails(deleteDoc(doc(bob(), 'docs/d1')));
    await assertSucceeds(deleteDoc(doc(alice(), 'docs/d1')));
  });

  it('refuses moving a doc to another owner or space, and invalid fields', async () => {
    await seedDoc('d1', 'alice');
    const update = (data: object) =>
      updateDoc(doc(alice(), 'docs/d1'), { ...data, updatedAt: serverTimestamp() });
    await assertFails(update({ ownerId: 'bob' }));
    await assertFails(update({ spaceId: 'space-bob' }));
    await assertFails(update({ title: 'x'.repeat(501) }));
    await assertFails(update({ deleted: 'yes' }));
    await assertFails(update({ preview: 'x'.repeat(301) }));
    await assertSucceeds(update({ preview: 'First lines' }));
    await assertFails(updateDoc(doc(alice(), 'docs/d1'), { title: 'No timestamp' }));
  });
});

describe('docs/{docId}/blocks/{blockId}', () => {
  const block = (updatedBy = 'alice') => ({
    type: 'paragraph',
    content: { text: 'Hello' },
    order: 'a0',
    updatedBy,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  it('lets the doc owner write and read blocks', async () => {
    await seedDoc('d1', 'alice');
    await assertSucceeds(setDoc(doc(alice(), 'docs/d1/blocks/b1'), block()));
    await assertSucceeds(getDocs(collection(alice(), 'docs/d1/blocks')));
    await assertSucceeds(deleteDoc(doc(alice(), 'docs/d1/blocks/b1')));
  });

  it('refuses other users, unknown block types and spoofed authors', async () => {
    await seedDoc('d1', 'alice');
    await assertFails(setDoc(doc(bob(), 'docs/d1/blocks/b1'), block('bob')));
    await assertFails(getDocs(collection(bob(), 'docs/d1/blocks')));
    await assertFails(setDoc(doc(alice(), 'docs/d1/blocks/b1'), { ...block(), type: 'script' }));
    await assertFails(setDoc(doc(alice(), 'docs/d1/blocks/b1'), block('bob')));
  });
});

describe('tasks and task lists', () => {
  const task = (ownerId = 'alice') => ({
    spaceId: `space-${ownerId}`,
    ownerId,
    title: 'Buy milk',
    done: false,
    order: 'a0',
    scheduledDate: '2026-11-25',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  const list = (ownerId = 'alice') => ({
    spaceId: `space-${ownerId}`,
    ownerId,
    name: 'Work',
    icon: '💼',
    order: 'a0',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  it('lets the owner manage their tasks', async () => {
    await assertSucceeds(setDoc(doc(alice(), 'tasks/t1'), task()));
    await assertSucceeds(
      getDocs(query(collection(alice(), 'tasks'), where('ownerId', '==', 'alice'))),
    );
    await assertSucceeds(
      updateDoc(doc(alice(), 'tasks/t1'), { done: true, updatedAt: serverTimestamp() }),
    );
    await assertSucceeds(deleteDoc(doc(alice(), 'tasks/t1')));
  });

  it('keeps tasks private and valid', async () => {
    await assertSucceeds(setDoc(doc(alice(), 'tasks/t1'), task()));
    await assertFails(getDoc(doc(bob(), 'tasks/t1')));
    await assertFails(setDoc(doc(bob(), 'tasks/t2'), task('alice')));
    await assertFails(setDoc(doc(alice(), 'tasks/t3'), { ...task(), done: 'no' }));
    await assertFails(
      updateDoc(doc(alice(), 'tasks/t1'), { ownerId: 'bob', updatedAt: serverTimestamp() }),
    );
  });

  it('lets the owner manage task lists, with a name', async () => {
    await assertSucceeds(setDoc(doc(alice(), 'taskLists/l1'), list()));
    await assertFails(setDoc(doc(alice(), 'taskLists/l2'), { ...list(), name: '' }));
    await assertFails(getDoc(doc(bob(), 'taskLists/l1')));
  });
});

describe('users/{uid}/stars/{docId}', () => {
  it('is private to the user', async () => {
    await assertSucceeds(
      setDoc(doc(alice(), 'users/alice/stars/d1'), { starredAt: serverTimestamp() }),
    );
    await assertSucceeds(getDocs(collection(alice(), 'users/alice/stars')));
    await assertFails(getDocs(collection(bob(), 'users/alice/stars')));
    await assertFails(setDoc(doc(bob(), 'users/alice/stars/d1'), { starredAt: serverTimestamp() }));
    await assertSucceeds(deleteDoc(doc(alice(), 'users/alice/stars/d1')));
  });
});
