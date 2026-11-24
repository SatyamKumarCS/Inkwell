import {
  Collections,
  completeProfileRequestSchema,
  fullName,
  type CompleteProfileResponse,
} from '@inkwell/shared';

import { lostCreateRace, SERVER_TIMESTAMP, type Firestore } from '../google/firestore';
import { ApiError } from '../http';
import type { VerifiedCaller } from './tokens';

const MAX_ATTEMPTS = 3;

async function existingSpaceId(db: Firestore, uid: string): Promise<string | null> {
  const user = await db.get(`${Collections.users}/${uid}`);
  return typeof user?.defaultSpaceId === 'string' ? user.defaultSpaceId : null;
}

/**
 * Creates `users/{uid}` and the user's default personal space in one atomic commit. Idempotent: if the
 * profile already exists, nothing is written and its default space is returned. Costs 1 read + 2 writes
 * (more only if concurrent calls race).
 */
export async function completeProfile(
  input: unknown,
  caller: VerifiedCaller,
  db: Firestore,
): Promise<CompleteProfileResponse> {
  const request = completeProfileRequestSchema.safeParse(input);
  if (!request.success) throw new ApiError('invalid-argument', 'Enter your first name.');
  const { firstName, lastName } = request.data;

  // Create-only writes can lose to a concurrent call (or be aborted by contention): re-read and retry.
  for (let attempt = 1; ; attempt++) {
    const existing = await existingSpaceId(db, caller.uid);
    if (existing) return { spaceId: existing };

    const spaceId = db.newId();
    try {
      // Both writes are create-only, so a concurrent call can't create a second profile or space.
      await db.commit([
        db.createWrite(`${Collections.spaces}/${spaceId}`, {
          name: 'Personal',
          icon: '🏠',
          ownerId: caller.uid,
          memberIds: [caller.uid],
          roles: { [caller.uid]: 'owner' },
          createdAt: SERVER_TIMESTAMP,
          updatedAt: SERVER_TIMESTAMP,
        }),
        db.createWrite(`${Collections.users}/${caller.uid}`, {
          displayName: fullName(firstName, lastName),
          firstName,
          lastName,
          email: caller.email,
          photoURL: caller.picture,
          defaultSpaceId: spaceId,
          settings: { theme: 'system', startOfWeek: 1 },
          fcmTokens: [],
          onboarding: {},
          createdAt: SERVER_TIMESTAMP,
          updatedAt: SERVER_TIMESTAMP,
        }),
      ]);
      return { spaceId };
    } catch (error) {
      if (!lostCreateRace(error) || attempt >= MAX_ATTEMPTS) throw error;
    }
  }
}
