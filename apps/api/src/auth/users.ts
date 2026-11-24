import { EmailExistsError, type AuthUser, type IdentityToolkit } from '../google/identityToolkit';
import type { ProviderIdentity } from './types';

/**
 * One email = one account: every sign-in method resolves a verified email to the same Auth user, creating
 * it only when no user has that email yet. `email` must already be normalised (trimmed, lower-case).
 */
export async function findOrCreateUserByEmail(
  idt: IdentityToolkit,
  email: string,
): Promise<AuthUser> {
  const existing = await idt.lookupByEmail(email);
  if (existing) {
    // The caller has just proven they control this address.
    return existing.emailVerified ? existing : idt.setEmailVerified(existing.uid);
  }
  try {
    return await idt.createUser(email);
  } catch (error) {
    // Another request created the same user between our lookup and create.
    if (error instanceof EmailExistsError) {
      const created = await idt.lookupByEmail(email);
      if (created) return created;
    }
    throw error;
  }
}

/**
 * Resolves a verified identity from a sign-in provider to exactly one account:
 * 1. an account already linked to this provider identity;
 * 2. otherwise the account with the same email (e.g. created with an email code), which gets the
 *    provider linked;
 * 3. otherwise a new account, with the provider linked.
 */
export async function findOrLinkProviderUser(
  idt: IdentityToolkit,
  identity: ProviderIdentity,
): Promise<AuthUser> {
  const linked = await idt.lookupByProvider(identity.providerId, identity.providerUid);
  if (linked) return linked;

  const user = await findOrCreateUserByEmail(idt, identity.email);
  if (user.providerIds.includes(identity.providerId)) return user;
  return idt.linkProvider(user.uid, {
    providerId: identity.providerId,
    rawId: identity.providerUid,
    email: identity.email,
    displayName: identity.displayName,
    photoUrl: identity.photoURL,
  });
}
