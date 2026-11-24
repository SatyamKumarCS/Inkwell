import type { Auth, UserRecord } from 'firebase-admin/auth';

function hasCode(error: unknown, code: string): boolean {
  return (error as { code?: unknown } | null)?.code === code;
}

/**
 * One email = one account: every sign-in method resolves a verified email to the same Auth user, creating
 * it only when no user has that email yet. `email` must already be normalised (trimmed, lower-case).
 */
export async function findOrCreateUserByEmail(auth: Auth, email: string): Promise<UserRecord> {
  try {
    const existing = await auth.getUserByEmail(email);
    // The caller has just proven they control this address.
    return existing.emailVerified
      ? existing
      : await auth.updateUser(existing.uid, { emailVerified: true });
  } catch (error) {
    if (!hasCode(error, 'auth/user-not-found')) throw error;
  }

  try {
    return await auth.createUser({ email, emailVerified: true });
  } catch (error) {
    // Another request created the same user between our lookup and create.
    if (hasCode(error, 'auth/email-already-exists')) return auth.getUserByEmail(email);
    throw error;
  }
}
