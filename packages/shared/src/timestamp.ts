import { z } from 'zod';

/**
 * Structural Firestore timestamp. React Native Firebase, the Admin SDK and the web SDK each have their
 * own Timestamp class, but all of them expose `seconds` and `nanoseconds`, so models use this shape.
 */
export interface FirestoreTimestamp {
  readonly seconds: number;
  readonly nanoseconds: number;
}

export const timestampSchema = z.custom<FirestoreTimestamp>(
  (value) =>
    typeof value === 'object' &&
    value !== null &&
    typeof (value as FirestoreTimestamp).seconds === 'number' &&
    typeof (value as FirestoreTimestamp).nanoseconds === 'number',
  { message: 'Expected a Firestore timestamp' },
);

export function timestampToMillis(ts: FirestoreTimestamp): number {
  return ts.seconds * 1000 + Math.floor(ts.nanoseconds / 1_000_000);
}

/** Fields every stored document carries (server timestamps). */
export const auditFieldsSchema = z.object({
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

/** "YYYY-MM-DD", used for daily notes and task dates. */
export const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');
