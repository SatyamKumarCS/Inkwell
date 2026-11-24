import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import {
  Collections,
  completeProfileRequestSchema,
  fullName,
  type CompleteProfileResponse,
  type Space,
  type User,
} from '@inkwell/shared';

type NewDoc<T> = Omit<T, 'createdAt' | 'updatedAt'> & {
  createdAt: FieldValue;
  updatedAt: FieldValue;
};

export interface ProfileCaller {
  uid: string;
  email: string | null;
  photoURL: string | null;
}

/**
 * Creates `users/{uid}` and the user's default personal space in one transaction. Idempotent: if the
 * profile already exists, nothing is written and its default space is returned.
 */
export async function completeProfile(
  input: unknown,
  caller: ProfileCaller,
  db: Firestore,
): Promise<CompleteProfileResponse> {
  const request = completeProfileRequestSchema.safeParse(input);
  if (!request.success) throw new HttpsError('invalid-argument', 'Enter your first name.');
  const { firstName, lastName } = request.data;

  const userRef = db.collection(Collections.users).doc(caller.uid);

  return db.runTransaction(async (tx) => {
    const existing = await tx.get(userRef);
    const existingSpaceId = existing.get('defaultSpaceId') as unknown;
    if (existing.exists && typeof existingSpaceId === 'string') {
      return { spaceId: existingSpaceId };
    }

    const spaceRef = db.collection(Collections.spaces).doc();
    const now = FieldValue.serverTimestamp();

    const space: NewDoc<Space> = {
      name: 'Personal',
      icon: '🏠',
      ownerId: caller.uid,
      memberIds: [caller.uid],
      roles: { [caller.uid]: 'owner' },
      createdAt: now,
      updatedAt: now,
    };
    const user: NewDoc<User> = {
      displayName: fullName(firstName, lastName),
      firstName,
      lastName,
      email: caller.email,
      photoURL: caller.photoURL,
      defaultSpaceId: spaceRef.id,
      settings: { theme: 'system', startOfWeek: 1 },
      fcmTokens: [],
      onboarding: {},
      createdAt: now,
      updatedAt: now,
    };

    tx.set(spaceRef, space);
    tx.set(userRef, user);
    return { spaceId: spaceRef.id };
  });
}
