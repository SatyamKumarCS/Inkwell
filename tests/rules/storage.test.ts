import {
  assertFails,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import 'firebase/compat/storage'; // rules-unit-testing's context.storage() relies on the compat module
import { getBytes, ref, uploadString } from 'firebase/storage';
import { afterAll, beforeAll, describe, it } from 'vitest';

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-inkwell',
    storage: { rules: readFileSync(resolve(import.meta.dirname, '../../storage.rules'), 'utf8') },
  });
});

afterAll(async () => {
  await env?.cleanup();
});

describe('Phase 0 storage rules', () => {
  it('denies unauthenticated reads', async () => {
    await assertFails(getBytes(ref(env.unauthenticatedContext().storage(), 'users/alice/a.png')));
  });

  it('denies signed-in uploads', async () => {
    await assertFails(
      uploadString(ref(env.authenticatedContext('alice').storage(), 'users/alice/a.png'), 'x'),
    );
  });
});
