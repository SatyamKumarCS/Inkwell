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

export interface ProviderIdentity {
  /** Firebase provider id, e.g. `google.com` (later `apple.com`). */
  providerId: string;
  /** The provider's stable user id (`sub`). */
  providerUid: string;
  /** Verified email, already normalised. */
  email: string;
  displayName?: string;
  photoURL?: string;
}

/**
 * Resolves a verified identity from a sign-in provider to exactly one account:
 * 1. an account already linked to this provider identity;
 * 2. otherwise the account with the same email (e.g. created with an email code), which gets the
 *    provider linked;
 * 3. otherwise a new account, with the provider linked.
 */
export async function findOrLinkProviderUser(
  auth: Auth,
  identity: ProviderIdentity,
): Promise<UserRecord> {
  try {
    return await auth.getUserByProviderUid(identity.providerId, identity.providerUid);
  } catch (error) {
    if (!hasCode(error, 'auth/user-not-found')) throw error;
  }

  const user = await findOrCreateUserByEmail(auth, identity.email);
  if (user.providerData.some((provider) => provider.providerId === identity.providerId)) {
    return user;
  }
  return auth.updateUser(user.uid, {
    providerToLink: {
      providerId: identity.providerId,
      uid: identity.providerUid,
      email: identity.email,
      displayName: identity.displayName,
      photoURL: identity.photoURL,
    },
  });
}
