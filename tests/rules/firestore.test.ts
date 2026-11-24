import {
  assertFails,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { afterAll, beforeAll, describe, it } from 'vitest';

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

// Phase 0 rules deny everything. Later phases replace these with allowed + denied cases per collection.
const paths = [
  'users/alice',
  'spaces/s1',
  'docs/d1',
  'tasks/t1',
  'publicDocs/slug',
  'config/aiModels',
];

describe('Phase 0 firestore rules', () => {
  for (const path of paths) {
    it(`denies unauthenticated read of ${path}`, async () => {
      await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), path)));
    });

    it(`denies signed-in write to ${path}`, async () => {
      await assertFails(setDoc(doc(env.authenticatedContext('alice').firestore(), path), { x: 1 }));
    });
  }
});
